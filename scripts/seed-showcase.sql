-- =============================================================================
-- MenuPage Full Showcase Seed Script for tusharkhadde06@gmail.com & /r/xai
-- Run this in your Neon SQL Editor, Supabase, psql, or pgAdmin.
-- =============================================================================

DO $$
DECLARE
  v_user_id TEXT;
  v_restaurant_id TEXT;
  v_cat_pizzas TEXT := gen_random_uuid()::text;
  v_cat_pastas TEXT := gen_random_uuid()::text;
  v_cat_starters TEXT := gen_random_uuid()::text;
  v_cat_drinks TEXT := gen_random_uuid()::text;
  v_cat_desserts TEXT := gen_random_uuid()::text;
  v_item_margherita TEXT := gen_random_uuid()::text;
  v_item_burrata TEXT := gen_random_uuid()::text;
  v_item_diavola TEXT := gen_random_uuid()::text;
  v_item_fries TEXT := gen_random_uuid()::text;
  v_item_fettuccine TEXT := gen_random_uuid()::text;
  v_item_tea TEXT := gen_random_uuid()::text;
  v_item_tiramisu TEXT := gen_random_uuid()::text;
  v_item_calzone TEXT := gen_random_uuid()::text;
  v_today TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
  v_yesterday TEXT := TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD');
  v_two_days_ago TEXT := TO_CHAR(CURRENT_DATE - INTERVAL '2 days', 'YYYY-MM-DD');
  v_tomorrow TEXT := TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'YYYY-MM-DD');
  v_day_after TEXT := TO_CHAR(CURRENT_DATE + INTERVAL '2 days', 'YYYY-MM-DD');
BEGIN

  -- 1. Ensure user exists
  INSERT INTO users (id, email, name, is_demo)
  VALUES (gen_random_uuid()::text, 'tusharkhadde06@gmail.com', 'Tushar Khadde', false)
  ON CONFLICT (email) DO UPDATE SET is_demo = false, name = 'Tushar Khadde';

  SELECT id INTO v_user_id FROM users WHERE email = 'tusharkhadde06@gmail.com' LIMIT 1;

  -- 2. Activate Pro plan
  INSERT INTO billing_accounts (user_id, plan, status, subscription_id, product_id, current_period_end, cancel_at_period_end)
  VALUES (v_user_id, 'pro', 'active', 'sub_showcase_pro', 'manual_pro', '2099-12-31 23:59:59+00', false)
  ON CONFLICT (user_id) DO UPDATE SET
    plan = 'pro',
    status = 'active',
    subscription_id = 'sub_showcase_pro',
    product_id = 'manual_pro',
    current_period_end = '2099-12-31 23:59:59+00',
    cancel_at_period_end = false,
    updated_at = NOW();

  -- 3. Upsert restaurant 'xai'
  INSERT INTO restaurants (
    id, owner_id, slug, name, tagline, description, cuisine, currency, timezone,
    theme, phone, whatsapp, whatsapp_ordering, instagram, address, maps_url,
    google_reviews_url, swiggy_url, zomato_url, upi_id, promo_banner, languages,
    happy_hour, hours, orders_enabled, service_requests_enabled, feedback_enabled,
    reservations_enabled, digest_enabled, published
  )
  VALUES (
    gen_random_uuid()::text,
    v_user_id,
    'xai',
    'XAI Artisan Pizza & Kitchen',
    'Woodfired Neapolitan Pizzas, Artisanal Pastas & Craft Brews',
    'Authentic Neapolitan sourdough pizzas baked at 450°C in our Italian stone oven, fresh hand-rolled pasta, specialty appetizers and gourmet desserts. Crafted with imported Caputo flour, San Marzano tomatoes, and fresh Fior di Latte.',
    'Italian · Neapolitan Pizza · Café',
    'INR',
    'Asia/Kolkata',
    'midnight',
    '+91 94043 32955',
    '919404332955',
    true,
    'menupage',
    '102, High Street Lane, FC Road, Deccan Gymkhana, Pune, Maharashtra 411004',
    'https://maps.google.com/?q=Pune',
    'https://search.google.com/local/writereview?placeid=ChIJ',
    'https://www.swiggy.com',
    'https://www.zomato.com',
    '9404332955@upi',
    '🍕 PROMO: 20% OFF on all Pizzas above ₹499! Use code XAI20 · Happy Hour 4 PM - 7 PM',
    ARRAY['hi', 'mr', 'es'],
    '{"days":[1,2,3,4,5],"from":"16:00","to":"19:00","percent":20}'::jsonb,
    '{"mon":{"closed":false,"ranges":[{"open":"11:00","close":"23:00"}]},"tue":{"closed":false,"ranges":[{"open":"11:00","close":"23:00"}]},"wed":{"closed":false,"ranges":[{"open":"11:00","close":"23:00"}]},"thu":{"closed":false,"ranges":[{"open":"11:00","close":"23:00"}]},"fri":{"closed":false,"ranges":[{"open":"11:00","close":"00:00"}]},"sat":{"closed":false,"ranges":[{"open":"11:00","close":"00:00"}]},"sun":{"closed":false,"ranges":[{"open":"11:00","close":"23:30"}]}}'::jsonb,
    true, true, true, true, true, true
  )
  ON CONFLICT (slug) DO UPDATE SET
    owner_id = v_user_id,
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    cuisine = EXCLUDED.cuisine,
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    theme = EXCLUDED.theme,
    phone = EXCLUDED.phone,
    whatsapp = EXCLUDED.whatsapp,
    whatsapp_ordering = true,
    instagram = EXCLUDED.instagram,
    address = EXCLUDED.address,
    maps_url = EXCLUDED.maps_url,
    google_reviews_url = EXCLUDED.google_reviews_url,
    swiggy_url = EXCLUDED.swiggy_url,
    zomato_url = EXCLUDED.zomato_url,
    upi_id = EXCLUDED.upi_id,
    promo_banner = EXCLUDED.promo_banner,
    languages = EXCLUDED.languages,
    happy_hour = EXCLUDED.happy_hour,
    hours = EXCLUDED.hours,
    orders_enabled = true,
    service_requests_enabled = true,
    feedback_enabled = true,
    reservations_enabled = true,
    digest_enabled = true,
    published = true,
    updated_at = NOW();

  SELECT id INTO v_restaurant_id FROM restaurants WHERE slug = 'xai' LIMIT 1;

  -- 4. Clean old related data for fresh showcase
  DELETE FROM categories WHERE restaurant_id = v_restaurant_id;
  DELETE FROM coupons WHERE restaurant_id = v_restaurant_id;
  DELETE FROM service_requests WHERE restaurant_id = v_restaurant_id;
  DELETE FROM reservations WHERE restaurant_id = v_restaurant_id;
  DELETE FROM feedback WHERE restaurant_id = v_restaurant_id;
  DELETE FROM orders WHERE restaurant_id = v_restaurant_id;
  DELETE FROM events WHERE restaurant_id = v_restaurant_id;
  DELETE FROM glossary_entries WHERE restaurant_id = v_restaurant_id;

  -- 5. Insert Categories
  INSERT INTO categories (id, restaurant_id, name, description, position) VALUES
    (v_cat_pizzas, v_restaurant_id, 'Woodfired Pizzas', 'Baked at 450°C in our stone oven. Slow-fermented 48-hour sourdough crust.', 0),
    (v_cat_pastas, v_restaurant_id, 'Handcrafted Pastas', 'Hand-rolled fresh egg pasta cooked al dente.', 1),
    (v_cat_starters, v_restaurant_id, 'Appetizers & Small Plates', 'Crispy bites, fresh bread and sharing platters.', 2),
    (v_cat_drinks, v_restaurant_id, 'Beverages & Craft Brews', 'Artisanal coffees, sparkling sodas, and mocktails.', 3),
    (v_cat_desserts, v_restaurant_id, 'Desserts', 'Sweet Italian conclusions.', 4);

  -- 6. Insert Items
  INSERT INTO items (id, restaurant_id, category_id, name, description, price_minor, diet, spicy, allergens, bestseller, sold_out, special, calories, nutrition, options, happy_hour, position) VALUES
    (
      v_item_margherita, v_restaurant_id, v_cat_pizzas, 'Margherita Classica',
      'San Marzano tomato sauce, fresh Fior di Latte mozzarella, fresh basil, extra virgin olive oil.',
      34000, 'veg', 0, ARRAY['dairy', 'gluten'], true, false, true, 780, 'Protein 28g · Carbs 92g · Fat 24g',
      '{"variants":[{"id":"v1","name":"Regular (10\")","priceMinor":34000},{"id":"v2","name":"Large (12\")","priceMinor":49000}],"groups":[{"id":"g1","name":"Crust & Cheese","min":0,"max":3,"options":[{"id":"g1o1","name":"Extra Buffalo Mozzarella","priceMinor":7000},{"id":"g1o2","name":"White Truffle Oil Drizzle","priceMinor":5000},{"id":"g1o3","name":"Fresh Basil Leaves","priceMinor":2000}]}]}'::jsonb,
      true, 0
    ),
    (
      v_item_burrata, v_restaurant_id, v_cat_pizzas, 'Burrata & Roasted Truffle Pizza',
      'Creamy artisanal burrata ball in center, wild forest mushrooms, roasted garlic, thyme, white truffle oil.',
      54000, 'veg', 0, ARRAY['dairy', 'gluten'], true, false, true, 890, null, null, false, 1
    ),
    (
      v_item_diavola, v_restaurant_id, v_cat_pizzas, 'Diavola (Spicy Pepperoni)',
      'Artisanal pork pepperoni, crushed Calabrian chillies, tomato sugo, mozzarella, hot honey drizzle.',
      48000, 'nonveg', 2, ARRAY['gluten', 'dairy'], true, false, false, 920, null,
      '{"variants":[{"id":"v1","name":"Regular (10\")","priceMinor":48000},{"id":"v2","name":"Large (12\")","priceMinor":64000}]}'::jsonb,
      true, 2
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_cat_pizzas, 'Quattro Formaggi',
      'Four-cheese blend: creamy Gorgonzola, aged Parmigiano Reggiano, fontina, fior di latte with caramelized figs.',
      46000, 'veg', 0, ARRAY['dairy', 'gluten'], false, false, false, 850, null, null, true, 3
    ),
    (
      v_item_fettuccine, v_restaurant_id, v_cat_pastas, 'Fettuccine Alfredo con Funghi',
      'House fettuccine tossed in a rich parmesan cream reduction with wild porcini and portobello mushrooms.',
      38000, 'veg', 0, ARRAY['dairy', 'gluten'], true, false, false, 680, null,
      '{"groups":[{"id":"g1","name":"Add Protein","min":0,"max":1,"options":[{"id":"g1o1","name":"Grilled Herb Chicken","priceMinor":8000},{"id":"g1o2","name":"Sautéed Tiger Prawns","priceMinor":12000}]}]}'::jsonb,
      true, 0
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_cat_pastas, 'Spaghetti Aglio Olio e Peperoncino',
      'Cold-pressed extra virgin olive oil, golden garlic slivers, dried bird''s eye chillies, fresh parsley.',
      32000, 'vegan', 2, ARRAY['gluten'], false, false, false, 510, null, null, true, 1
    ),
    (
      v_item_fries, v_restaurant_id, v_cat_starters, 'Truffle Parmesan Fries',
      'Hand-cut Idaho potato fries tossed with white truffle oil, rosemary sea salt, and aged 24-month parmesan.',
      22000, 'veg', 0, ARRAY['dairy'], true, false, false, 390, null, null, true, 0
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_cat_starters, 'Garlic Sourdough Dough Knots',
      'Fresh pizza dough tied in knots, brushed with garlic herb butter, served with warm marinara dip.',
      19000, 'veg', 0, ARRAY['gluten', 'dairy'], false, false, false, 310, null, null, true, 1
    ),
    (
      v_item_tea, v_restaurant_id, v_cat_drinks, 'Peach Basil Iced Tea',
      'Slow-brewed Assam black tea, white peach purée, bruised basil leaves, splash of sparkling water.',
      14000, 'vegan', 0, ARRAY[]::text[], true, false, false, null, null, null, true, 0
    ),
    (
      v_item_tiramisu, v_restaurant_id, v_cat_desserts, 'Traditional Venetian Tiramisu',
      'Savoiardi ladyfinger biscuits dipped in espresso liqueur, whipped mascarpone cream, dark cocoa dust.',
      28000, 'egg', 0, ARRAY['dairy', 'gluten', 'egg'], true, false, true, 420, null, null, false, 0
    ),
    (
      v_item_calzone, v_restaurant_id, v_cat_desserts, 'Warm Nutella Calzone',
      'Folded woodfired pizza dough stuffed with molten Nutella, toasted hazelnuts, served with vanilla bean gelato.',
      31000, 'veg', 0, ARRAY['dairy', 'gluten', 'nuts'], true, false, false, 590, null, null, false, 1
    );

  -- 7. Insert Coupons
  INSERT INTO coupons (id, restaurant_id, code, kind, value, min_order_minor, active, uses, max_uses) VALUES
    (gen_random_uuid()::text, v_restaurant_id, 'XAI20', 'percent', 20, 49900, true, 14, 100),
    (gen_random_uuid()::text, v_restaurant_id, 'WELCOME50', 'amount', 5000, 25000, true, 8, 50);

  -- 8. Insert Live & Historical Orders
  INSERT INTO orders (id, restaurant_id, day, number, ref, table_label, customer_name, customer_phone, note, lines, currency, subtotal_minor, discount_minor, total_minor, coupon_code, status, paid) VALUES
    (
      gen_random_uuid()::text, v_restaurant_id, v_today, 1, 'XAI-101', 'Table 4', 'Rahul Sharma', '+91 98234 56789',
      'Extra crispy crust please',
      json_build_array(
        json_build_object('itemId', v_item_margherita, 'name', 'Margherita Classica', 'qty', 1, 'unitMinor', 34000, 'options', 'Regular (10")'),
        json_build_object('itemId', v_item_fries, 'name', 'Truffle Parmesan Fries', 'qty', 1, 'unitMinor', 22000, 'options', null)
      )::jsonb,
      'INR', 56000, 11200, 44800, 'XAI20', 'new', false
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_today, 2, 'XAI-102', 'Table 8', 'Pooja Kulkarni', '+91 97654 32100',
      'Mild spice',
      json_build_array(
        json_build_object('itemId', v_item_burrata, 'name', 'Burrata & Roasted Truffle Pizza', 'qty', 1, 'unitMinor', 54000, 'options', null),
        json_build_object('itemId', v_item_tea, 'name', 'Peach Basil Iced Tea', 'qty', 2, 'unitMinor', 14000, 'options', null)
      )::jsonb,
      'INR', 82000, 0, 82000, null, 'preparing', true
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_today, 3, 'XAI-103', 'Table 2', 'Aditya Verma', '+91 94220 88990',
      'Pack cutlery',
      json_build_array(
        json_build_object('itemId', v_item_fettuccine, 'name', 'Fettuccine Alfredo con Funghi', 'qty', 1, 'unitMinor', 38000, 'options', 'Grilled Herb Chicken'),
        json_build_object('itemId', v_item_tiramisu, 'name', 'Traditional Venetian Tiramisu', 'qty', 1, 'unitMinor', 28000, 'options', null)
      )::jsonb,
      'INR', 66000, 0, 66000, null, 'ready', true
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_today, 4, 'XAI-104', 'Table 6', 'Simran Kaur', '+91 99887 76655',
      null,
      json_build_array(
        json_build_object('itemId', v_item_diavola, 'name', 'Diavola (Spicy Pepperoni)', 'qty', 1, 'unitMinor', 48000, 'options', 'Regular (10")')
      )::jsonb,
      'INR', 48000, 0, 48000, null, 'done', true
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_yesterday, 1, 'XAI-089', 'Table 3', 'Dr. Arvind Joshi', '+91 98221 44332',
      null,
      json_build_array(
        json_build_object('itemId', v_item_margherita, 'name', 'Margherita Classica', 'qty', 2, 'unitMinor', 34000, 'options', 'Regular (10")'),
        json_build_object('itemId', v_item_calzone, 'name', 'Warm Nutella Calzone', 'qty', 1, 'unitMinor', 31000, 'options', null)
      )::jsonb,
      'INR', 99000, 0, 99000, null, 'done', true
    ),
    (
      gen_random_uuid()::text, v_restaurant_id, v_two_days_ago, 1, 'XAI-075', 'Table 5', 'Meera Nair', '+91 97660 11223',
      'Birthday celebration',
      json_build_array(
        json_build_object('itemId', v_item_burrata, 'name', 'Burrata & Roasted Truffle Pizza', 'qty', 1, 'unitMinor', 54000, 'options', null)
      )::jsonb,
      'INR', 54000, 0, 54000, null, 'done', true
    );

  -- 9. Table Service Requests
  INSERT INTO service_requests (id, restaurant_id, table_label, kind, resolved_at) VALUES
    (gen_random_uuid()::text, v_restaurant_id, 'Table 4', 'waiter', null),
    (gen_random_uuid()::text, v_restaurant_id, 'Table 8', 'bill', null),
    (gen_random_uuid()::text, v_restaurant_id, 'Table 2', 'waiter', NOW() - INTERVAL '10 minutes');

  -- 10. Feedback & Ratings
  INSERT INTO feedback (id, restaurant_id, rating, comment, name, contact, table_label) VALUES
    (gen_random_uuid()::text, v_restaurant_id, 5, 'The Neapolitan Margherita pizza is hands down the best in the city. Incredible crust and sauce!', 'Ananya Sharma', 'ananya@example.com', 'Table 5'),
    (gen_random_uuid()::text, v_restaurant_id, 5, 'Loved the Truffle Burrata pizza and Venetian Tiramisu. Outstanding service & vibe!', 'Rohan Mehta', '+91 98223 33445', 'Table 3'),
    (gen_random_uuid()::text, v_restaurant_id, 4, 'Food was fantastic, ordering through WhatsApp was smooth and fast.', 'Priya Patil', null, 'Table 8'),
    (gen_random_uuid()::text, v_restaurant_id, 5, 'Crispy fries, delightful dough knots and authentic Italian espresso. 10/10!', 'Vikram Sen', null, 'Table 12');

  -- 11. Table Reservations
  INSERT INTO reservations (id, restaurant_id, name, phone, email, date, time, party_size, note, status) VALUES
    (gen_random_uuid()::text, v_restaurant_id, 'Kavita Deshmukh', '+91 98220 11223', 'kavita.d@example.com', v_tomorrow, '20:00', 4, 'Anniversary dinner, window corner table preferred.', 'accepted'),
    (gen_random_uuid()::text, v_restaurant_id, 'Aditya Roy', '+91 98901 44556', 'aditya.roy@example.com', v_tomorrow, '19:30', 6, 'Family reunion. Need 1 high chair.', 'pending'),
    (gen_random_uuid()::text, v_restaurant_id, 'Sameer Joshi', '+91 97654 33221', 'sameer.j@example.com', v_day_after, '21:00', 2, 'Quiet table for date night.', 'accepted');

  -- 12. Analytics Events
  INSERT INTO events (restaurant_id, type, day, meta)
  SELECT v_restaurant_id, 'view'::text, v_today, '{"table":"Table 4"}'::jsonb FROM generate_series(1, 25)
  UNION ALL
  SELECT v_restaurant_id, 'scan'::text, v_today, '{"table":"Table 4"}'::jsonb FROM generate_series(1, 12)
  UNION ALL
  SELECT v_restaurant_id, 'whatsapp'::text, v_today, '{"table":"Table 4"}'::jsonb FROM generate_series(1, 6)
  UNION ALL
  SELECT v_restaurant_id, 'view'::text, v_yesterday, '{"table":"Table 8"}'::jsonb FROM generate_series(1, 20)
  UNION ALL
  SELECT v_restaurant_id, 'scan'::text, v_yesterday, '{"table":"Table 8"}'::jsonb FROM generate_series(1, 10)
  UNION ALL
  SELECT v_restaurant_id, 'whatsapp'::text, v_yesterday, '{"table":"Table 8"}'::jsonb FROM generate_series(1, 5);

  -- 13. Glossary Entries
  INSERT INTO glossary_entries (id, restaurant_id, term, aliases, explanation) VALUES
    (gen_random_uuid()::text, v_restaurant_id, 'Fior di Latte', ARRAY['fior-di-latte', 'fresh mozzarella'], 'Fresh whole-milk mozzarella cheese from Italy, soft and delicate.'),
    (gen_random_uuid()::text, v_restaurant_id, 'San Marzano', ARRAY['san marzano tomatoes'], 'Sweet Italian plum tomatoes grown in volcanic soil near Mount Vesuvius.'),
    (gen_random_uuid()::text, v_restaurant_id, 'Diavola', ARRAY['spicy diavola'], 'Classic spicy Italian pizza topped with seasoned cured meat and hot chillies.');

  RAISE NOTICE '✓ Comprehensive showcase data successfully populated for xai and tusharkhadde06@gmail.com!';
END $$;
