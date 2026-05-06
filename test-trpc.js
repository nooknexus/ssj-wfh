const { createTRPCClient, httpBatchLink } = require('@trpc/client');
const superjson = require('superjson');
const fetch = require('node-fetch'); // or use global fetch if node > 18

async function run() {
  const response = await fetch("http://localhost:3004/api/trpc/attendance.getAdminRecords?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22startDate%22%3A%222026-05-01T00%3A00%3A00.000Z%22%2C%22endDate%22%3A%222026-05-05T00%3A00%3A00.000Z%22%2C%22limit%22%3A50%7D%2C%22meta%22%3A%7B%22values%22%3A%7B%22startDate%22%3A%5B%22Date%22%5D%2C%22endDate%22%3A%5B%22Date%22%5D%7D%7D%7D%7D");
  const text = await response.text();
  console.log("Raw Response:");
  console.log(text);
}
run().catch(console.error);
