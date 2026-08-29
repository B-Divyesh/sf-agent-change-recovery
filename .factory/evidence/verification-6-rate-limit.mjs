const url = 'https://api.sociobot.in/api/v1/products/agent-change-recovery/verify?license=qa-verification-6-invalid-token';
const observations = [];
for (let index = 1; index <= 31; index += 1) {
  const response = await fetch(url);
  observations.push({ index, status: response.status, retryAfter: response.headers.get('retry-after'), rateAfter: response.headers.get('x-ratelimit-after') });
  await response.text();
}
console.log(JSON.stringify(observations, null, 2));
