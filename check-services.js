#!/usr/bin/env node

/**
 * Simple service verification - OS agnostic
 */

const http = require('http');

const services = [
  { name: 'Retool', url: 'http://localhost:3333', port: 3333 },
  { name: 'Camunda', url: 'http://localhost:8080/camunda', port: 8080 },
  { name: 'Middleware', url: 'http://localhost:3000/health', port: 3000 },
  { name: 'Data API', url: 'http://localhost:3001/health', port: 3001 }
];

console.log('Checking services...\n');

let checked = 0;
services.forEach(service => {
  const url = new URL(service.url);
  http.get(service.url, res => {
    console.log(`✓ ${service.name.padEnd(12)} http://localhost:${service.port}`);
    if (++checked === services.length) done();
  }).on('error', () => {
    console.log(`✗ ${service.name.padEnd(12)} http://localhost:${service.port}`);
    if (++checked === services.length) done();
  });
});

function done() {
  console.log('\nServices are available at:');
  console.log('• Retool:    http://localhost:3333');
  console.log('• Camunda:   http://localhost:8080/camunda (demo/demo)');
  console.log('• Middleware: http://localhost:3000');
  console.log('• Data API:  http://localhost:3001');
}
