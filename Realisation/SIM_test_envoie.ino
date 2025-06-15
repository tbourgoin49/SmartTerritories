#include <HardwareSerial.h>
#include "DFRobot_SHT3x.h"
#include "DFRobot_MultiGasSensor.h"
#include <DFRobot_ICP10111.h>
#include <esp_system.h>  // Pour esp_restart()

#define I2C_ADDRESS_NO2  0x69
#define I2C_ADDRESS_O3   0x74

#define ZONE_ID "SaintAubin"
#define QOS "0"
#define zonetopic "SmartTerritories"
#define testmosquittoorg "37.153.140.41"

HardwareSerial simSerial(1); // UART1 : TX=17, RX=16
DFRobot_SHT3x sht3x(&Wire, 0x45);
DFRobot_ICP10111 icp;
DFRobot_GAS_I2C gasNO2(&Wire, I2C_ADDRESS_NO2);
DFRobot_GAS_I2C gasO3(&Wire, I2C_ADDRESS_O3); 

bool capteurOK_SHT = false;
bool capteurOK_ICP = false;
bool capteurOK_NO2 = false;
bool capteurOK_O3  = false;

String sendATCommand(String command, int waitTime = 5000) {
  while (simSerial.available()) simSerial.read();
  simSerial.println(command);
  Serial.println(" Envoi : " + command);

  unsigned long start = millis();
  String response = "";

  while (millis() - start < waitTime) {
    while (simSerial.available()) {
      char c = simSerial.read();
      response += c;
    }
    if (response.indexOf("OK") != -1 || response.indexOf("ERROR") != -1) {
      break;
    }
  }

  Serial.println(" Réponse :\n" + response);
  return response;
}

void checkCriticalCommand(String command, int waitTime = 5000) {
  String response = sendATCommand(command, waitTime);
  if (response.length() == 0) {
    Serial.println("Aucune réponse à la commande critique : " + command);
    delay(2000);
    esp_restart();  // Redémarrage ESP32
  }
}

bool isNetworkAttached() {
  String response = sendATCommand("AT+CGATT?", 5000);
  return response.indexOf("+CGATT: 1") != -1;
}

void configureSIM7080G_stepByStep() {
  String cmdsBeforeNetwork[] = {
    "AT",
    "AT+CMEE=2",
    "AT+CPIN?",
    "AT+CMNB=1",
    "AT+CNMP=38",
    "AT+CGDCONT=1,\"IP\",\"bicsapn\"",
    "AT+CNCFG=1,1,\"bicsapn\"",
    "AT+COPS=1,2,\"20820\"",
    "AT+CSQ",
    "AT+CREG?"
  };

  for (String cmd : cmdsBeforeNetwork) {
    checkCriticalCommand(cmd, 7000);
    delay(1000);
  }

  checkCriticalCommand("AT+CNACT=1,1", 10000);

  if (!isNetworkAttached()) {
    Serial.println("Pas de connexion réseau !");
    delay(2000);
    esp_restart();
  }

  Serial.println("Connexion réseau établie.");

  String cmdsAfterNetwork[] = {
    "AT+CLTS=1",
    "AT+CGATT?",
    "AT+SNPING4=\"" testmosquittoorg "\",1,1,2",
    "AT+SMCONF=\"URL\",\"" testmosquittoorg "\",1883",
    "AT+SMCONF=\"QOS\",\"" QOS "\"",
    "AT+SMCONF=\"TOPIC\",\"" zonetopic "\"",
    "AT+SMCONF=\"CLIENTID\",\"" ZONE_ID "\""
  };

  for (String cmd : cmdsAfterNetwork) {
    checkCriticalCommand(cmd, 7000);
    delay(1000);
  }
}

String getNetworkTime() {
  String response = sendATCommand("AT+CCLK?");
  if (response.indexOf("+CCLK") != -1) {
    int startIdx = response.indexOf("\"") + 1;
    int endIdx = response.indexOf("\"", startIdx);
    return response.substring(startIdx, endIdx);
  }
  return "00/00/00 00:00:00";
}

void publishMessage(String message) {
  int msgLength = message.length();
  String pubCommand = "AT+SMPUB=\"" + String(zonetopic) + "\"," + String(msgLength) + "," + QOS + ",0";
  checkCriticalCommand(pubCommand, 1000);
  simSerial.print(message);
  Serial.println(" Message publié : " + message);
  delay(3000);
}

void setup() {
  pinMode(2, OUTPUT);
  digitalWrite(2, LOW);
  delay(5000);
  digitalWrite(2, HIGH);

  Wire.begin(21, 22);
  Serial.begin(115200);
  simSerial.begin(115200, SERIAL_8N1, 16, 17);

  configureSIM7080G_stepByStep();

  if (icp.begin() == 0) {
    capteurOK_ICP = true;
    icp.setWorkPattern(icp.eNormal);
  } else Serial.println(" Capteur ICP-10111 non détecté !");

  if (sht3x.begin() == 0) capteurOK_SHT = true;
  else Serial.println(" Capteur SHT3x non détecté !");

  if (gasNO2.begin()) {
    capteurOK_NO2 = true;
    gasNO2.changeAcquireMode(gasNO2.PASSIVITY);
    gasNO2.setTempCompensation(gasNO2.ON);
  } else Serial.println(" Capteur NO2 non détecté !");

  if (gasO3.begin()) {
    capteurOK_O3 = true;
    gasO3.changeAcquireMode(gasO3.PASSIVITY);
    gasO3.setTempCompensation(gasO3.ON);
  } else Serial.println(" Capteur O3 non détecté !");

  float temperature = capteurOK_SHT ? sht3x.getTemperatureC() : 0.0;
  float humidity = capteurOK_SHT ? sht3x.getHumidityRH() : 0.0;
  float pressure = capteurOK_ICP ? icp.getAirPressure() / 100.0 : 0.0;
  float no2_ppm = capteurOK_NO2 ? gasNO2.readGasConcentrationPPM() : 0.0;
  float o3_ppm = capteurOK_O3 ? gasO3.readGasConcentrationPPM() : 0.0;

  String networkTime = getNetworkTime();
  int year = networkTime.substring(0, 2).toInt() + 2000;
  int month = networkTime.substring(3, 5).toInt();
  int day = networkTime.substring(6, 8).toInt();
  int hour = networkTime.substring(9, 11).toInt();
  char dateTimeBuffer[20];
  snprintf(dateTimeBuffer, sizeof(dateTimeBuffer), "%04d-%02d-%02d %02d", year, month, day, hour);

  checkCriticalCommand("AT+SMCONN", 5000);
  delay(3000);

  if (capteurOK_SHT) {
    publishMessage("{\"Capteur\":\"" + String(ZONE_ID) + "\",\"TypeDeDonnee\":\"Temperature\",\"Date\":\"" + dateTimeBuffer + "\",\"Valeur\":" + String(temperature, 1) + "}");
    publishMessage("{\"Capteur\":\"" + String(ZONE_ID) + "\",\"TypeDeDonnee\":\"Humidite\",\"Date\":\"" + dateTimeBuffer + "\",\"Valeur\":" + String(humidity, 1) + "}");
  }
  if (capteurOK_ICP) {
    publishMessage("{\"Capteur\":\"" + String(ZONE_ID) + "\",\"TypeDeDonnee\":\"Pression\",\"Date\":\"" + dateTimeBuffer + "\",\"Valeur\":" + String(pressure, 1) + "}");
  }
  if (capteurOK_NO2) {
    publishMessage("{\"Capteur\":\"" + String(ZONE_ID) + "\",\"TypeDeDonnee\":\"NO2\",\"Date\":\"" + dateTimeBuffer + "\",\"Valeur\":" + String(no2_ppm, 2) + "}");
  }
  if (capteurOK_O3) {
    publishMessage("{\"Capteur\":\"" + String(ZONE_ID) + "\",\"TypeDeDonnee\":\"O3\",\"Date\":\"" + dateTimeBuffer + "\",\"Valeur\":" + String(o3_ppm, 2) + "}");
  }

  sendATCommand("AT+SMDISC", 2000);
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) simSerial.println(cmd);
  }

  if (simSerial.available()) {
    Serial.write(simSerial.read());
  }
}
