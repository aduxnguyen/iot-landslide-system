/**
 * ====================================================================================
 * ĐỒ ÁN MÔN HỌC: IOT VÀ ỨNG DỤNG - ĐỀ XUẤT HỆ THỐNG CẢNH BÁO SẠT LỞ ĐẤT DO MƯA
 * MÃ NGUỒN VI ĐIỀU KHIỂN: ESP8266 NODE CHÂN DỐC (node_bottom)
 * 
 * Các linh kiện kết nối:
 * 1. Cảm biến MPU6050 (I2C: D1-SCL, D2-SDA): Đo góc nghiêng và rung chấn mái dốc
 * 2. Cảm biến độ ẩm đất điện dung: Chân A0
 * 3. Động cơ Servo SG90 (Barie): Chân D5 (GPIO14)
 * 4. Còi Buzzer cảnh báo: Chân D6 (GPIO12)
 * 5. Cụm LED trạng thái:
 *    - LED Xanh (NORMAL): Chân D7 (GPIO13)
 *    - LED Vàng (WATCH):  Chân D8 (GPIO15)
 *    - LED Đỏ (MOVEMENT): Chân D0 (GPIO16)
 * 
 * Chức năng:
 * - Thu thập dữ liệu cảm biến định kỳ 2 giây gửi lên MQTT Broker.
 * - Lắng nghe lệnh điều khiển từ xa (QoS 1) và gửi phản hồi xác nhận (cmd_ack).
 * - CƠ CHẾ AN TOÀN TẠI CHỖ (EDGE FAILSAFE): Nếu mất mạng Wi-Fi/MQTT mà góc nghiêng
 *   biến thiên vượt ngưỡng nguy hiểm, ESP8266 TỰ ĐỘNG hạ barie, bật còi và đèn đỏ
 *   ngay tại phần cứng mà không phụ thuộc vào kết nối máy chủ!
 * ====================================================================================
 */

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Servo.h>
#include <Wire.h>

// ----------------- CẤU HÌNH WI-FI & MQTT BROKER -----------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";          // Tên mạng Wi-Fi
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";      // Mật khẩu Wi-Fi
const char* MQTT_SERVER   = "192.168.1.100";           // IP LAN của máy tính chạy server/broker
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "iot_user";
const char* MQTT_PASSWORD = "iot_secure_pass2026";
const char* CLIENT_ID     = "esp8266_node_bottom";

// ----------------- ĐỊNH NGHĨA CHÂN PHẦN CỨNG -----------------
#define PIN_SERVO         14  // D5
#define PIN_BUZZER        12  // D6
#define PIN_LED_GREEN     13  // D7
#define PIN_LED_YELLOW    15  // D8
#define PIN_LED_RED       16  // D0
#define PIN_SOIL_ADC      A0

// ----------------- CẤU HÌNH GÓC SERVO BARIE -----------------
#define BARRIER_ANGLE_OPEN    0   // Góc mở barie
#define BARRIER_ANGLE_CLOSED  90  // Góc hạ barie đóng đường

// Ngưỡng phát hiện sạt lở khẩn cấp tại chỗ (Edge threshold)
#define LOCAL_TILT_FAILSAFE_THRESHOLD 2.5 // độ

// ----------------- KHỞI TẠO ĐỐI TƯỢNG -----------------
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Servo barrierServo;

// ----------------- BIẾN TOÀN CỤC TRẠNG THÁI -----------------
String barrierState = "OPEN";
bool buzzerActive = false;
String currentLedState = "GREEN";
String controlMode = "AUTO"; // "AUTO" hoặc "MANUAL"
bool localAlarmLatched = false;

// Hiệu chuẩn MPU6050
float zeroTiltX = 0.0;
float zeroTiltY = 0.0;
const int MPU_ADDR = 0x68;

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 2000; // 2 giây

// ----------------- NGUYÊN MẪU HÀM -----------------
void setupWiFi();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void setLed(String color);
void readMPU6050(float &tiltX, float &tiltY, float &tiltDelta);
float readSoilMoisture();
void handleCommand(JsonObject doc);
void sendAck(const char* cmdId, bool ok, const char* msg);

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- Khoi dong ESP8266 Node Bottom ---");

  // Khởi tạo chân I/O
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  setLed("GREEN");

  // Khởi tạo Servo barie
  barrierServo.attach(PIN_SERVO);
  barrierServo.write(BARRIER_ANGLE_OPEN);
  barrierState = "OPEN";

  // Khởi tạo I2C cho MPU6050
  Wire.begin(4, 5); // SDA=D2 (GPIO4), SCL=D1 (GPIO5)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // Thanh ghi quản lý nguồn
  Wire.write(0);    // Đánh thức MPU6050
  Wire.endTransmission(true);

  // Kết nối Wi-Fi & MQTT
  setupWiFi();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  // Duy trì kết nối Wi-Fi & MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      reconnectMQTT();
    }
    mqttClient.loop();
  }

  // Đọc cảm biến
  float tiltX = 0, tiltY = 0, tiltDelta = 0;
  readMPU6050(tiltX, tiltY, tiltDelta);
  float soilMoisture = readSoilMoisture();

  // ----------------- CƠ CHẾ AN TOÀN TẠI CHỖ (LOCAL FAILSAFE) -----------------
  // Ngay cả khi mất mạng, nếu góc nghiêng đột ngột vượt ngưỡng an toàn:
  if (tiltDelta >= LOCAL_TILT_FAILSAFE_THRESHOLD) {
    if (controlMode == "AUTO" && !localAlarmLatched) {
      barrierServo.write(BARRIER_ANGLE_CLOSED);
      barrierState = "CLOSED";
      digitalWrite(PIN_BUZZER, HIGH);
      buzzerActive = true;
      setLed("RED");
      localAlarmLatched = true;
      Serial.println("🚨 [EDGE FAILSAFE] Phat hien sat lo! Tu dong dong barie & bao dong!");
    }
  }

  // ----------------- ĐỊNH KỲ GỬI TELEMETRY 2 GIÂY -----------------
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = now;

    if (mqttClient.connected()) {
      StaticJsonDocument<256> doc;
      doc["ts"] = (uint32_t)(now / 1000);
      doc["soil_bottom"] = serialized(String(soilMoisture, 1));
      doc["tilt_x"] = serialized(String(tiltX, 2));
      doc["tilt_y"] = serialized(String(tiltY, 2));
      doc["tilt_delta"] = serialized(String(tiltDelta, 2));
      doc["state_local"] = localAlarmLatched ? "MOVEMENT" : (soilMoisture > 65.0 ? "WATCH" : "NORMAL");
      doc["barrier"] = barrierState;
      doc["buzzer"] = buzzerActive;
      doc["rssi"] = WiFi.RSSI();

      char buffer[256];
      serializeJson(doc, buffer);
      mqttClient.publish("landslide/node_bottom/telemetry", buffer, false);
      Serial.print("Telemetry Sent: ");
      Serial.println(buffer);
    }
  }
}

// ----------------- KẾT NỐI WI-FI -----------------
void setupWiFi() {
  Serial.print("Ket noi WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✔ WiFi da ket noi! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n⚠ WiFi chua ket noi duoc. Chay o che do ngoai tuyen cuc bo (Offline mode).");
  }
}

// ----------------- KẾT NỐI MQTT BROKER -----------------
void reconnectMQTT() {
  static unsigned long lastReconnectAttempt = 0;
  unsigned long now = millis();
  if (now - lastReconnectAttempt < 3000) return;
  lastReconnectAttempt = now;

  Serial.print("Dang ket noi MQTT Mosquitto...");
  // Cấu hình Last Will: nếu mất mạng đột ngột -> broker tự động publish "offline" (retained)
  if (mqttClient.connect(CLIENT_ID, MQTT_USER, MQTT_PASSWORD, "landslide/node_bottom/status", 1, true, "offline")) {
    Serial.println(" Thanh cong!");
    // Báo online
    mqttClient.publish("landslide/node_bottom/status", "online", true);
    // Subscribe các topic điều khiển
    mqttClient.subscribe("landslide/node_bottom/cmd", 1);
    mqttClient.subscribe("landslide/node_bottom/state", 1);
  } else {
    Serial.print(" That bai, rc=");
    Serial.println(mqttClient.state());
  }
}

// ----------------- XỬ LÝ GÓI TIN ĐẾN TỪ SERVER -----------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';

  String topicStr = String(topic);

  // 1. Trạng thái hệ thống tổng thể do Backend phân tích đẩy xuống
  if (topicStr == "landslide/node_bottom/state") {
    String desiredState = String(message);
    Serial.println("[MQTT] Nhan desired state: " + desiredState);
    if (!localAlarmLatched) {
      if (desiredState == "NORMAL") setLed("GREEN");
      else if (desiredState == "WATCH") setLed("YELLOW");
      else if (desiredState == "MOVEMENT") {
        setLed("RED");
        if (controlMode == "AUTO") {
          barrierServo.write(BARRIER_ANGLE_CLOSED);
          barrierState = "CLOSED";
          digitalWrite(PIN_BUZZER, HIGH);
          buzzerActive = true;
          localAlarmLatched = true;
        }
      }
    }
    return;
  }

  // 2. Lệnh điều khiển trực tiếp
  if (topicStr == "landslide/node_bottom/cmd") {
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
      Serial.println("Loi parse JSON cmd");
      return;
    }
    handleCommand(doc.as<JsonObject>());
  }
}

// ----------------- THỰC THI LỆNH ĐIỀU KHIỂN & PHẢN HỒI ACK -----------------
void handleCommand(JsonObject doc) {
  const char* cmdId = doc["cmd_id"];
  const char* action = doc["action"];

  if (!cmdId || !action) return;

  bool ok = true;
  String msg = "";

  if (strcmp(action, "barrier_close") == 0) {
    barrierServo.write(BARRIER_ANGLE_CLOSED);
    barrierState = "CLOSED";
    msg = "Barie da dong xuong hoan toan";
  } else if (strcmp(action, "barrier_open") == 0) {
    barrierServo.write(BARRIER_ANGLE_OPEN);
    barrierState = "OPEN";
    localAlarmLatched = false;
    msg = "Barie da mo len thong xe";
  } else if (strcmp(action, "buzzer_mute") == 0) {
    digitalWrite(PIN_BUZZER, LOW);
    buzzerActive = false;
    msg = "Da tat coi buzzer";
  } else if (strcmp(action, "reset_alarm") == 0) {
    barrierServo.write(BARRIER_ANGLE_OPEN);
    barrierState = "OPEN";
    digitalWrite(PIN_BUZZER, LOW);
    buzzerActive = false;
    localAlarmLatched = false;
    setLed("GREEN");
    msg = "Da reset toan bo trang thai canh bao an toan";
  } else if (strcmp(action, "set_led_test") == 0) {
    // Nhấp nháy test LED
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_BUZZER, HIGH);
    delay(300);
    digitalWrite(PIN_BUZZER, LOW);
    setLed("GREEN");
    msg = "Da hoan thanh chu trinh test LED va Coi";
  } else if (strcmp(action, "set_mode") == 0) {
    const char* val = doc["value"];
    controlMode = (val && strcmp(val, "MANUAL") == 0) ? "MANUAL" : "AUTO";
    msg = "Che do da chuyen sang: " + controlMode;
  } else {
    ok = false;
    msg = "Lenh khong duoc ho tro tren firmware";
  }

  sendAck(cmdId, ok, msg.c_str());
}

// ----------------- GỬI PHẢN HỒI XÁC NHẬN (CMD_ACK) -----------------
void sendAck(const char* cmdId, bool ok, const char* msg) {
  StaticJsonDocument<256> doc;
  doc["cmd_id"] = cmdId;
  doc["ok"] = ok;
  doc["msg"] = msg;

  JsonObject stateObj = doc.createNestedObject("state");
  stateObj["barrier"] = barrierState;
  stateObj["buzzer"] = buzzerActive;

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish("landslide/node_bottom/cmd_ack", buffer, 1);
  Serial.print("Sent ACK: ");
  Serial.println(buffer);
}

// ----------------- ĐIỀU KHIỂN CỤM ĐÈN LED -----------------
void setLed(String color) {
  currentLedState = color;
  digitalWrite(PIN_LED_GREEN, color == "GREEN" ? HIGH : LOW);
  digitalWrite(PIN_LED_YELLOW, color == "YELLOW" ? HIGH : LOW);
  digitalWrite(PIN_LED_RED, color == "RED" ? HIGH : LOW);
}

// ----------------- ĐỌC GIA TỐC & GÓC NGHIÊNG MPU6050 -----------------
void readMPU6050(float &tiltX, float &tiltY, float &tiltDelta) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // Bắt đầu đọc từ thanh ghi ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);

  if (Wire.available() >= 6) {
    int16_t ax = Wire.read() << 8 | Wire.read();
    int16_t ay = Wire.read() << 8 | Wire.read();
    int16_t az = Wire.read() << 8 | Wire.read();

    // Quy đổi ra đơn vị g
    float fx = (float)ax / 16384.0;
    float fy = (float)ay / 16384.0;
    float fz = (float)az / 16384.0;

    // Tính góc nghiêng (độ)
    tiltX = atan2(fy, sqrt(fx * fx + fz * fz)) * 180.0 / PI - zeroTiltX;
    tiltY = atan2(-fx, sqrt(fy * fy + fz * fz)) * 180.0 / PI - zeroTiltY;
    tiltDelta = sqrt(tiltX * tiltX + tiltY * tiltY);
  }
}

// ----------------- ĐỌC ĐỘ ẨM ĐẤT ĐIỆN DUNG -----------------
float readSoilMoisture() {
  int raw = analogRead(PIN_SOIL_ADC);
  // Quy đổi raw ADC (Air ~ 850, Water ~ 420) sang phần trăm 0 - 100%
  const int DRY_RAW = 850;
  const int WET_RAW = 420;
  float pct = (float)(DRY_RAW - raw) / (float)(DRY_RAW - WET_RAW) * 100.0;
  return constrain(pct, 0.0, 100.0);
}
