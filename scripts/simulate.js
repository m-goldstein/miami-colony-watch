const apiUrl = process.env.API_URL || 'http://127.0.0.1:3000';
const deviceId = process.argv[2] || 'CW-001';
const scenario = process.argv[3] || 'low-food';
const response = await fetch(new URL('/api/demo/scenario', apiUrl), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId, scenario })
});
const result = await response.json();
if (!response.ok) { console.error(result.error); process.exitCode = 1; }
else console.log(`Fictional scenario '${scenario}' delivered to ${deviceId}. Open the dashboard to see the result.`);
