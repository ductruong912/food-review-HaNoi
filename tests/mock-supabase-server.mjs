import { createServer } from 'node:http';
import { rows } from './restaurant-fixtures.mjs';

const port = Number(process.env.MOCK_SUPABASE_PORT || 54321);

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, prefer',
    });
    return response.end();
  }

  if (request.method === 'GET' && url.pathname === '/rest/v1/restaurants') {
    const idFilter = url.searchParams.get('id');
    const result = idFilter?.startsWith('eq.')
      ? rows.filter(row => row.id === idFilter.slice(3))
      : rows;
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-range': `0-${Math.max(result.length - 1, 0)}/${result.length}`,
      'access-control-allow-origin': '*',
    });
    return response.end(JSON.stringify(result));
  }

  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ message: 'Mock Supabase endpoint not configured' }));
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Mock Supabase REST listening on 127.0.0.1:${port}\n`);
});
