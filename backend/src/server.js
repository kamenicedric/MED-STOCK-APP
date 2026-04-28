require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { supabaseAdmin } = require('./supabaseAdmin');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

function requireApiKey(req, res, next) {
  const requiredKey = process.env.BACKEND_API_KEY;
  if (!requiredKey) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== requiredKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'med-stock-backend' });
});

app.use('/api', requireApiKey);

app.get('/api/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, pharmacy_name, owner_name, location, notification_phone, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data || null);
});

app.put('/api/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const {
    pharmacy_name,
    owner_name,
    location,
    notification_phone,
    avatar_url,
  } = req.body || {};

  if (!pharmacy_name || !String(pharmacy_name).trim()) {
    return res.status(400).json({ error: 'pharmacy_name est obligatoire.' });
  }

  const payload = {
    id: userId,
    pharmacy_name: String(pharmacy_name).trim(),
    owner_name: owner_name ? String(owner_name).trim() : null,
    location: location ? String(location).trim() : null,
    notification_phone: notification_phone ? String(notification_phone).trim() : null,
    avatar_url: avatar_url ? String(avatar_url).trim() : null,
  };

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

app.get('/api/stock/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select('id, name, form, dosage, barcode, min_threshold')
    .eq('user_id', userId)
    .order('name');
  if (productsError) return res.status(400).json({ error: productsError.message });

  const { data: lots, error: lotsError } = await supabaseAdmin
    .from('inventory_lots')
    .select('product_id, quantity, expiry_date')
    .eq('user_id', userId);
  if (lotsError) return res.status(400).json({ error: lotsError.message });

  const byProduct = {};
  (lots || []).forEach((lot) => {
    const id = lot.product_id;
    if (!byProduct[id]) byProduct[id] = { totalQty: 0, earliestExpiry: null };
    byProduct[id].totalQty += lot.quantity || 0;
    if (
      lot.expiry_date &&
      (!byProduct[id].earliestExpiry || lot.expiry_date < byProduct[id].earliestExpiry)
    ) {
      byProduct[id].earliestExpiry = lot.expiry_date;
    }
  });

  const result = (products || []).map((p) => ({
    ...p,
    total_quantity: byProduct[p.id]?.totalQty || 0,
    earliest_expiry: byProduct[p.id]?.earliestExpiry || null,
  }));

  return res.json(result);
});

app.get('/api/reports/:userId/today', async (req, res) => {
  const { userId } = req.params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: sales, error } = await supabaseAdmin
    .from('sales')
    .select('id, total_amount, created_at')
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  const total = (sales || []).reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  return res.json({
    revenue_today: total,
    sales_count: sales?.length || 0,
    sales: sales || [],
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erreur interne serveur.' });
});

app.listen(PORT, () => {
  console.log(`Med-Stock backend running on http://localhost:${PORT}`);
});
