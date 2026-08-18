#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>
#include <strings.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_wifi.h"
#include "mqtt_client.h"
#include "cJSON.h"
#include "driver/gpio.h"

#define WIFI_SSID CONFIG_WIFI_SSID
#define WIFI_PASSWORD CONFIG_WIFI_PASSWORD
#define GARDEN_ID CONFIG_GARDEN_ID
#define USER_ID CONFIG_USER_ID
#define MQTT_BROKER_URI CONFIG_MQTT_BROKER_URI
#define MQTT_SENSOR_TOPIC CONFIG_MQTT_SENSOR_TOPIC
#define MQTT_COMMAND_TOPIC CONFIG_MQTT_COMMAND_TOPIC
#define MQTT_ACK_TOPIC CONFIG_MQTT_ACK_TOPIC
#define MQTT_STATUS_TOPIC CONFIG_MQTT_STATUS_TOPIC
#define LED_RED_GPIO CONFIG_LED_RED_GPIO
#define LED_YELLOW_GPIO CONFIG_LED_YELLOW_GPIO
#define LED_GREEN_GPIO CONFIG_LED_GREEN_GPIO

static const char *TAG = "SmartGardenESP";
static EventGroupHandle_t s_wifi_event_group;
static esp_mqtt_client_handle_t mqtt_client = NULL;
static int packet_no = 0;
static bool led1_state = false;
static bool led2_state = false;
static bool led3_state = false;

#define WIFI_CONNECTED_BIT BIT0

static void publish_ack(void);

static bool is_on_value(const char *value)
{
    return value != NULL && (strcasecmp(value, "On") == 0 || strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0);
}

static const char *state_to_string(bool state)
{
    return state ? "On" : "Off";
}

static void led_init(void)
{
    gpio_reset_pin(LED_RED_GPIO);
    gpio_reset_pin(LED_YELLOW_GPIO);
    gpio_reset_pin(LED_GREEN_GPIO);

    gpio_set_direction(LED_RED_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_direction(LED_YELLOW_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_direction(LED_GREEN_GPIO, GPIO_MODE_OUTPUT);

    gpio_set_level(LED_RED_GPIO, led1_state ? 1 : 0);
    gpio_set_level(LED_YELLOW_GPIO, led2_state ? 1 : 0);
    gpio_set_level(LED_GREEN_GPIO, led3_state ? 1 : 0);

    ESP_LOGI(TAG, "LED GPIOs initialized => red:%d yellow:%d green:%d",
             LED_RED_GPIO, LED_YELLOW_GPIO, LED_GREEN_GPIO);
}

static void apply_led_state(const char *led1, const char *led2, const char *led3)
{
    if (led1) {
        led1_state = is_on_value(led1);
        gpio_set_level(LED_RED_GPIO, led1_state ? 1 : 0);
    }
    if (led2) {
        led2_state = is_on_value(led2);
        gpio_set_level(LED_YELLOW_GPIO, led2_state ? 1 : 0);
    }
    if (led3) {
        led3_state = is_on_value(led3);
        gpio_set_level(LED_GREEN_GPIO, led3_state ? 1 : 0);
    }

    ESP_LOGI(TAG, "LED state updated => red:%s yellow:%s green:%s",
             state_to_string(led1_state),
             state_to_string(led2_state),
             state_to_string(led3_state));
}

static void handle_mqtt_command(const char *data, int len)
{
    cJSON *root = cJSON_ParseWithLength(data, len);
    if (!root) {
        ESP_LOGW(TAG, "Invalid command JSON");
        return;
    }

    cJSON *gardenId = cJSON_GetObjectItem(root, "gardenId");
    if (cJSON_IsString(gardenId)) {
        ESP_LOGI(TAG, "Command for garden %s", gardenId->valuestring);
    }

    cJSON *led1 = cJSON_GetObjectItem(root, "led1State");
    cJSON *led2 = cJSON_GetObjectItem(root, "led2State");
    cJSON *led3 = cJSON_GetObjectItem(root, "led3State");

    apply_led_state(
        cJSON_IsString(led1) ? led1->valuestring : NULL,
        cJSON_IsString(led2) ? led2->valuestring : NULL,
        cJSON_IsString(led3) ? led3->valuestring : NULL);

    cJSON_Delete(root);
    publish_ack();
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;

    switch ((esp_mqtt_event_id_t)event_id) {
        case MQTT_EVENT_CONNECTED:
            ESP_LOGI(TAG, "Connected to MQTT broker");
            esp_mqtt_client_subscribe(mqtt_client, MQTT_COMMAND_TOPIC, 0);
            break;
        case MQTT_EVENT_DATA:
            if (strncmp(event->topic, MQTT_COMMAND_TOPIC, event->topic_len) == 0) {
                handle_mqtt_command(event->data, event->data_len);
            }
            break;
        case MQTT_EVENT_DISCONNECTED:
            ESP_LOGW(TAG, "MQTT disconnected");
            break;
        default:
            break;
    }
}

static void wifi_event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        esp_wifi_connect();
        xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

static void wifi_init_sta(void)
{
    s_wifi_event_group = xEventGroupCreate();
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL));

    wifi_config_t wifi_config = { 0 };
    strncpy((char *)wifi_config.sta.ssid, WIFI_SSID, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, WIFI_PASSWORD, sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Connecting to Wi-Fi SSID:%s", WIFI_SSID);
    xEventGroupWaitBits(s_wifi_event_group, WIFI_CONNECTED_BIT, pdFALSE, pdTRUE, portMAX_DELAY);
}

static void mqtt_start(void)
{
    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URI,
    };

    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    ESP_ERROR_CHECK(esp_mqtt_client_start(mqtt_client));
}

static void publish_ack(void)
{
    if (!mqtt_client) {
        return;
    }

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "gardenId", GARDEN_ID);
    cJSON_AddStringToObject(root, "userId", USER_ID);
    cJSON_AddBoolToObject(root, "led1State", led1_state);
    cJSON_AddBoolToObject(root, "led2State", led2_state);
    cJSON_AddBoolToObject(root, "led3State", led3_state);
    cJSON_AddStringToObject(root, "led1StateText", state_to_string(led1_state));
    cJSON_AddStringToObject(root, "led2StateText", state_to_string(led2_state));
    cJSON_AddStringToObject(root, "led3StateText", state_to_string(led3_state));

    char *json = cJSON_PrintUnformatted(root);
    if (json) {
        esp_mqtt_client_publish(mqtt_client, MQTT_ACK_TOPIC, json, 0, 0, 0);
        free(json);
    }
    cJSON_Delete(root);
}

static void publish_led_status(void)
{
    if (!mqtt_client) {
        return;
    }

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "gardenId", GARDEN_ID);
    cJSON_AddStringToObject(root, "userId", USER_ID);
    cJSON_AddStringToObject(root, "led1State", state_to_string(led1_state));
    cJSON_AddStringToObject(root, "led2State", state_to_string(led2_state));
    cJSON_AddStringToObject(root, "led3State", state_to_string(led3_state));

    char *json = cJSON_PrintUnformatted(root);
    if (json) {
        esp_mqtt_client_publish(mqtt_client, MQTT_STATUS_TOPIC, json, 0, 0, 0);
        free(json);
    }
    cJSON_Delete(root);
}

static void sensor_task(void *pvParameters)
{
    while (1) {
        if (mqtt_client) {
            cJSON *root = cJSON_CreateObject();
            cJSON_AddStringToObject(root, "gardenId", GARDEN_ID);
            cJSON_AddStringToObject(root, "userId", USER_ID);
            cJSON_AddNumberToObject(root, "packet_no", ++packet_no);
            cJSON_AddNumberToObject(root, "temperature", 28.5 + (packet_no % 5));
            cJSON_AddNumberToObject(root, "humidity", 60.0 + (packet_no % 10));
            cJSON_AddStringToObject(root, "deviceId", "ESP32-SMART-GARDEN-01");

            char *json = cJSON_PrintUnformatted(root);
            if (json) {
                esp_mqtt_client_publish(mqtt_client, MQTT_SENSOR_TOPIC, json, 0, 0, 0);
                ESP_LOGI(TAG, "Published sensor data: %s", json);
                free(json);
            }
            cJSON_Delete(root);
            publish_led_status();
        }

        vTaskDelay(pdMS_TO_TICKS(CONFIG_SENSOR_PUBLISH_INTERVAL_MS));
    }
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    led_init();
    wifi_init_sta();
    mqtt_start();
    xTaskCreate(sensor_task, "sensor_task", 4096, NULL, 5, NULL);
}
