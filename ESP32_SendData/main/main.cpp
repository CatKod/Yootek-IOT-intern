#include <string>

#include "esp_err.h"
#include "esp_log.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <WiFi.h>
#include <ArduinoJson.h>
#include <Arduino.h>

#include "PubSubClient.h"

namespace {
constexpr const char *TAG = "ESP32_SendData";
constexpr const char *WIFI_SSID = "SONGNAM-STAFF";
constexpr const char *WIFI_PASSWORD = "songnam@123";
constexpr const char *MQTT_BROKER = "broker.hivemq.com";
constexpr uint16_t MQTT_PORT = 1883;
constexpr const char *MQTT_PUB_TOPIC = "esp32/sensors/data";
constexpr const char *MQTT_SUB_TOPIC = "esp32/control/command";
constexpr uint32_t PUBLISH_INTERVAL_MS = 5000;

WiFiClient wifi_client;
PubSubClient mqtt_client(wifi_client);
uint32_t packet_no = 0;
uint32_t last_publish_ms = 0;

void connect_wifi()
{
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }

    ESP_LOGI(TAG, "Connecting to WiFi SSID: %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED) {
        vTaskDelay(pdMS_TO_TICKS(500));
        ESP_LOGI(TAG, "Waiting for WiFi connection...");
    }

    ESP_LOGI(TAG, "WiFi connected. IP: %s", WiFi.localIP().toString().c_str());
}

void mqtt_callback(char *topic, byte *payload, unsigned int length)
{
    ESP_LOGI(TAG, "Message received on topic: %s", topic);

    std::string message(reinterpret_cast<char *>(payload), length);
    ESP_LOGI(TAG, "Raw payload: %s", message.c_str());

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    if (error) {
        ESP_LOGE(TAG, "Failed to parse control JSON: %s", error.c_str());
        return;
    }

    if (doc.containsKey("command")) {
        JsonVariant command = doc["command"];
        if (command.is<const char *>()) {
            ESP_LOGI(TAG, "Control command: %s", command.as<const char *>());
        } else {
            String serialized;
            serializeJson(command, serialized);
            ESP_LOGI(TAG, "Control command: %s", serialized.c_str());
        }
    } else {
        ESP_LOGW(TAG, "JSON does not contain 'command' field");
    }
}

void connect_mqtt()
{
    while (!mqtt_client.connected()) {
        String client_id = "esp32-senddata-" + String((uint32_t)esp_random(), HEX);
        ESP_LOGI(TAG, "Connecting to MQTT broker as %s", client_id.c_str());

        if (mqtt_client.connect(client_id.c_str())) {
            ESP_LOGI(TAG, "MQTT connected");
            mqtt_client.subscribe(MQTT_SUB_TOPIC);
            ESP_LOGI(TAG, "Subscribed to %s", MQTT_SUB_TOPIC);
        } else {
            ESP_LOGW(TAG, "MQTT connect failed, rc=%d. Retrying in 2 seconds", mqtt_client.state());
            vTaskDelay(pdMS_TO_TICKS(2000));
        }
    }
}

void publish_sensor_data()
{
    JsonDocument doc;
    doc["temperature"] = 25.0f + static_cast<float>(esp_random() % 1500) / 100.0f;
    doc["humidity"] = 50.0f + static_cast<float>(esp_random() % 3000) / 100.0f;
    doc["tds"] = 300 + static_cast<int>(esp_random() % 700);
    doc["pH"] = 6.5f + static_cast<float>(esp_random() % 180) / 100.0f;
    doc["packet_no"] = ++packet_no;

    char buffer[256];
    size_t len = serializeJson(doc, buffer, sizeof(buffer));
    if (len == 0 || len >= sizeof(buffer)) {
        ESP_LOGE(TAG, "Failed to serialize sensor JSON");
        return;
    }

    bool published = mqtt_client.publish(MQTT_PUB_TOPIC, buffer, len);
    if (published) {
        ESP_LOGI(TAG, "Published to %s: %s", MQTT_PUB_TOPIC, buffer);
    } else {
        ESP_LOGW(TAG, "Failed to publish sensor data");
    }
}

} // namespace

extern "C" void app_main(void)
{
    initArduino();

    connect_wifi();

    mqtt_client.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt_client.setCallback(mqtt_callback);
    mqtt_client.setBufferSize(512);
    mqtt_client.setKeepAlive(30);

    connect_mqtt();

    while (true) {
        if (WiFi.status() != WL_CONNECTED) {
            connect_wifi();
        }

        if (!mqtt_client.connected()) {
            connect_mqtt();
        }

        mqtt_client.loop();

        uint32_t now = millis();
        if (now - last_publish_ms >= PUBLISH_INTERVAL_MS) {
            last_publish_ms = now;
            publish_sensor_data();
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
