require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = 3000;

const mqttUrl = process.env.MQTT_URL;
const mqttOptions = {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
};

const mqttClient = mqtt.connect(mqttUrl, mqttOptions);

const wss = new WebSocket.Server({ noServer: true });

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('esp8266/temperature');
  mqttClient.subscribe('esp8266/fan/status');
});

mqttClient.on('message', (topic, message) => {
  console.log(`Received message on topic '${topic}': ${message.toString()}`);
  // Broadcast the message to all connected WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ topic, message: message.toString() }));
    }
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Upgrade HTTP server to handle WebSocket connections
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.topic === 'esp8266/fan/control') {
      mqttClient.publish('esp8266/fan/control', data.message);
    }
  });
});
