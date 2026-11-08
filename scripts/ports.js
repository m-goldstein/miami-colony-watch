import { SerialPort } from 'serialport';
const ports = await SerialPort.list();
if (!ports.length) console.log('No serial devices found. Connect the Arduino by USB.');
for (const port of ports) console.log(`${port.path}  ${port.manufacturer || 'Unknown board'}  ${port.serialNumber || ''}`);
