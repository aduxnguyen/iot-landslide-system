FROM eclipse-mosquitto:2.0

COPY config/mosquitto.conf /mosquitto/config/mosquitto.conf
COPY config/password.txt /mosquitto/config/password.txt

RUN mosquitto_passwd -U /mosquitto/config/password.txt

EXPOSE 1883
CMD ["/usr/sbin/mosquitto", "-c", "/mosquitto/config/mosquitto.conf"]
