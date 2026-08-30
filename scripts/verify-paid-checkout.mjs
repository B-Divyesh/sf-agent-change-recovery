const productSlug = 'agent-change-recovery';
const apiBase = process.env.SOCIOBOT_API_BASE ?? 'https://api.sociobot.in/api/v1';
const expectedCheckout = `${apiBase}/products/${productSlug}/checkout`;

const catalogResponse = await fetch(`${apiBase}/products`);
if (!catalogResponse.ok) throw new Error(`Product catalog returned HTTP ${catalogResponse.status}.`);
const catalog = await catalogResponse.json();
const product = catalog.data?.find(item => item.slug === productSlug);
if (!product) throw new Error('Change Recovery Ledger is absent from the public product catalog.');
if (product.price_minor !== 1500 || product.currency !== 'USD') {
  throw new Error('Change Recovery Ledger does not have the required $15 USD monthly price.');
}
if (product.checkout_url !== expectedCheckout) {
  throw new Error('The public catalog checkout URL does not match the registered product.');
}

const checkoutResponse = await fetch(product.checkout_url, { method: 'HEAD', redirect: 'manual' });
const location = checkoutResponse.headers.get('location') ?? '';
if (![301, 302, 303, 307, 308].includes(checkoutResponse.status) || !/^https:\/\/.*dodopayments\.com\//i.test(location)) {
  throw new Error(`Checkout did not redirect to hosted Sociobot/Dodo payment (HTTP ${checkoutResponse.status}).`);
}

console.log(`Paid checkout ready: ${product.slug} · $${(product.price_minor / 100).toFixed(2)} ${product.currency} · HTTP ${checkoutResponse.status}`);
