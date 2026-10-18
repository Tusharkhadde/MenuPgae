import { eq } from "drizzle-orm";
import { scriptDb } from "./db";
import {
  billingAccounts,
  categories,
  coupons,
  events,
  feedback,
  glossaryEntries,
  items,
  orders,
  reservations,
  restaurants,
  serviceRequests,
  users,
} from "../src/lib/db/schema";

const TARGET_EMAIL = "tusharkhadde06@gmail.com";
const TARGET_SLUG = "xai";

async function main() {
  console.log(`🚀 Seeding comprehensive showcase data for: ${TARGET_EMAIL} (${TARGET_SLUG})...`);
  const { db, migrate, close } = await scriptDb();
  await migrate();

  // 1. Ensure User exists and is not demo
  let [user] = await db.select().from(users).where(eq(users.email, TARGET_EMAIL)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: TARGET_EMAIL,
        name: "Tushar Khadde",
        isDemo: false,
      })
      .returning();
    console.log(`✓ Created user: ${user.email} (${user.id})`);
  } else {
    await db.update(users).set({ isDemo: false, name: "Tushar Khadde" }).where(eq(users.id, user.id));
    console.log(`✓ Found user: ${user.email} (${user.id})`);
  }

  // 2. Grant Active Pro Subscription
  const subId = `sub_showcase_${user.id.slice(0, 8)}`;
  await db
    .insert(billingAccounts)
    .values({
      userId: user.id,
      plan: "pro",
      status: "active",
      subscriptionId: subId,
      productId: "manual_pro",
      currentPeriodEnd: new Date("2099-12-31T23:59:59Z"),
      cancelAtPeriodEnd: false,
    })
    .onConflictDoUpdate({
      target: billingAccounts.userId,
      set: {
        plan: "pro",
        status: "active",
        subscriptionId: subId,
        productId: "manual_pro",
        currentPeriodEnd: new Date("2099-12-31T23:59:59Z"),
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
    });
  console.log(`✓ Pro subscription activated for ${TARGET_EMAIL}`);

  // 3. Upsert Restaurant 'xai'
  let [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, TARGET_SLUG)).limit(1);

  const restaurantData = {
    ownerId: user.id,
    slug: TARGET_SLUG,
    name: "XAI Artisan Pizza & Kitchen",
    tagline: "Woodfired Neapolitan Pizzas, Artisanal Pastas & Craft Brews",
    description:
      "Authentic Neapolitan sourdough pizzas baked at 450°C in our Italian oven, fresh hand-rolled pasta, specialty appetizers and gourmet desserts. Crafted with imported Caputo flour, San Marzano tomatoes, and fresh Fior di Latte.",
    cuisine: "Italian · Neapolitan Pizza · Café",
    currency: "INR",
    timezone: "Asia/Kolkata",
    theme: "midnight" as const,
    phone: "+91 94043 32955",
    whatsapp: "919404332955",
    whatsappOrdering: true,
    instagram: "menupage",
    address: "102, High Street Lane, FC Road, Deccan Gymkhana, Pune, Maharashtra 411004",
    mapsUrl: "https://maps.google.com/?q=Pune",
    googleReviewsUrl: "https://search.google.com/local/writereview?placeid=ChIJ",
    swiggyUrl: "https://www.swiggy.com",
    zomatoUrl: "https://www.zomato.com",
    upiId: "9404332955@upi",
    promoBanner: "🍕 PROMO: 20% OFF on all Pizzas above ₹499! Use code XAI20 · Happy Hour 4 PM - 7 PM",
    languages: ["hi", "mr", "es"],
    happyHour: {
      enabled: true,
      days: [1, 2, 3, 4, 5],
      from: "16:00",
      to: "19:00",
      percent: 20,
    },
    hours: {
      mon: { closed: false, ranges: [{ open: "11:00", close: "23:00" }] },
      tue: { closed: false, ranges: [{ open: "11:00", close: "23:00" }] },
      wed: { closed: false, ranges: [{ open: "11:00", close: "23:00" }] },
      thu: { closed: false, ranges: [{ open: "11:00", close: "23:00" }] },
      fri: { closed: false, ranges: [{ open: "11:00", close: "00:00" }] },
      sat: { closed: false, ranges: [{ open: "11:00", close: "00:00" }] },
      sun: { closed: false, ranges: [{ open: "11:00", close: "23:30" }] },
    },
    ordersEnabled: true,
    serviceRequestsEnabled: true,
    feedbackEnabled: true,
    reservationsEnabled: true,
    digestEnabled: true,
    published: true,
  };

  if (!restaurant) {
    [restaurant] = await db.insert(restaurants).values(restaurantData).returning();
    console.log(`✓ Created restaurant 'xai' (ID: ${restaurant.id})`);
  } else {
    await db.update(restaurants).set(restaurantData).where(eq(restaurants.id, restaurant.id));
    console.log(`✓ Updated restaurant 'xai' (ID: ${restaurant.id})`);
  }

  const rId = restaurant.id;

  // Clean old menu data for clean showcase
  await db.delete(categories).where(eq(categories.restaurantId, rId));
  await db.delete(coupons).where(eq(coupons.restaurantId, rId));
  await db.delete(serviceRequests).where(eq(serviceRequests.restaurantId, rId));
  await db.delete(reservations).where(eq(reservations.restaurantId, rId));
  await db.delete(feedback).where(eq(feedback.restaurantId, rId));
  await db.delete(orders).where(eq(orders.restaurantId, rId));
  await db.delete(events).where(eq(events.restaurantId, rId));
  await db.delete(glossaryEntries).where(eq(glossaryEntries.restaurantId, rId));

  // 4. Create Categories & Items
  const menuConfig = [
    {
      name: "Woodfired Pizzas",
      description: "Baked at 450°C in our stone oven. Slow-fermented 48-hour sourdough crust.",
      items: [
        {
          name: "Margherita Classica",
          description: "San Marzano tomato sauce, fresh Fior di Latte mozzarella, fresh basil, extra virgin olive oil.",
          priceMinor: 34000,
          diet: "veg" as const,
          bestseller: true,
          special: true,
          calories: 780,
          nutrition: "Protein 28g · Carbs 92g · Fat 24g",
          allergens: ["dairy", "gluten"],
          options: {
            variants: [
              { id: "v1", name: 'Regular (10")', priceMinor: 34000 },
              { id: "v2", name: 'Large (12")', priceMinor: 49000 },
            ],
            groups: [
              {
                id: "g1",
                name: "Crust & Cheese",
                min: 0,
                max: 3,
                options: [
                  { id: "g1o1", name: "Extra Buffalo Mozzarella", priceMinor: 7000 },
                  { id: "g1o2", name: "White Truffle Oil Drizzle", priceMinor: 5000 },
                  { id: "g1o3", name: "Fresh Basil Leaves", priceMinor: 2000 },
                ],
              },
            ],
          },
          happyHour: true,
        },
        {
          name: "Burrata & Roasted Truffle Pizza",
          description: "Creamy artisanal burrata ball in center, wild forest mushrooms, roasted garlic, thyme, white truffle oil.",
          priceMinor: 54000,
          diet: "veg" as const,
          bestseller: true,
          special: true,
          calories: 890,
          allergens: ["dairy", "gluten"],
          happyHour: false,
        },
        {
          name: "Diavola (Spicy Pepperoni)",
          description: "Artisanal pork pepperoni, crushed Calabrian chillies, tomato sugo, mozzarella, hot honey drizzle.",
          priceMinor: 48000,
          diet: "nonveg" as const,
          spicy: 2,
          bestseller: true,
          calories: 920,
          allergens: ["gluten", "dairy"],
          options: {
            variants: [
              { id: "v1", name: 'Regular (10")', priceMinor: 48000 },
              { id: "v2", name: 'Large (12")', priceMinor: 64000 },
            ],
          },
          happyHour: true,
        },
        {
          name: "Quattro Formaggi",
          description: "Four-cheese blend: creamy Gorgonzola, aged Parmigiano Reggiano, fontina, fior di latte with caramelized figs.",
          priceMinor: 46000,
          diet: "veg" as const,
          calories: 850,
          allergens: ["dairy", "gluten"],
          happyHour: true,
        },
        {
          name: "Pollo Affumicato & Jalapeño",
          description: "Herb-smoked chicken breast, pickled jalapeños, smoked scarmoza cheese, red onion, smoky BBQ drizzle.",
          priceMinor: 44000,
          diet: "nonveg" as const,
          spicy: 1,
          calories: 860,
          allergens: ["gluten", "dairy"],
          happyHour: true,
        },
        {
          name: "Pesto Genovese & Sundried Tomatoes",
          description: "Fresh house basil pesto, sundried cherry tomatoes, toasted pine nuts, vegan mozzarella.",
          priceMinor: 42000,
          diet: "vegan" as const,
          calories: 740,
          allergens: ["gluten", "nuts"],
          happyHour: true,
        },
      ],
    },
    {
      name: "Handcrafted Pastas",
      description: "Hand-rolled fresh egg pasta cooked al dente.",
      items: [
        {
          name: "Fettuccine Alfredo con Funghi",
          description: "House fettuccine tossed in a rich parmesan cream reduction with wild porcini and portobello mushrooms.",
          priceMinor: 38000,
          diet: "veg" as const,
          bestseller: true,
          calories: 680,
          allergens: ["dairy", "gluten"],
          options: {
            groups: [
              {
                id: "g1",
                name: "Add Protein",
                min: 0,
                max: 1,
                options: [
                  { id: "g1o1", name: "Grilled Herb Chicken", priceMinor: 8000 },
                  { id: "g1o2", name: "Sautéed Tiger Prawns", priceMinor: 12000 },
                ],
              },
            ],
          },
          happyHour: true,
        },
        {
          name: "Spaghetti Aglio Olio e Peperoncino",
          description: "Cold-pressed extra virgin olive oil, golden garlic slivers, dried bird's eye chillies, fresh parsley.",
          priceMinor: 32000,
          diet: "vegan" as const,
          spicy: 2,
          calories: 510,
          allergens: ["gluten"],
          happyHour: true,
        },
        {
          name: "Penne alla Vodka Rosa",
          description: "Slow-simmered San Marzano tomatoes, cream, crushed red pepper flakes and grated pecorino cheese.",
          priceMinor: 36000,
          diet: "veg" as const,
          spicy: 1,
          calories: 620,
          allergens: ["dairy", "gluten"],
          happyHour: true,
        },
        {
          name: "Lasagna Bolognese Tradizionale",
          description: "Layered pasta sheets with slow-braised meat ragu, silky béchamel, and golden parmesan crust.",
          priceMinor: 46000,
          diet: "nonveg" as const,
          bestseller: true,
          calories: 790,
          allergens: ["gluten", "dairy", "egg"],
          happyHour: false,
        },
      ],
    },
    {
      name: "Appetizers & Small Plates",
      description: "Crispy bites, fresh bread and sharing platters.",
      items: [
        {
          name: "Truffle Parmesan Fries",
          description: "Hand-cut Idaho potato fries tossed with white truffle oil, rosemary sea salt, and aged 24-month parmesan.",
          priceMinor: 22000,
          diet: "veg" as const,
          bestseller: true,
          calories: 390,
          allergens: ["dairy"],
          happyHour: true,
        },
        {
          name: "Garlic Sourdough Dough Knots",
          description: "Fresh pizza dough tied in knots, brushed with garlic herb butter, served with warm marinara dip.",
          priceMinor: 19000,
          diet: "veg" as const,
          calories: 310,
          allergens: ["gluten", "dairy"],
          happyHour: true,
        },
        {
          name: "Bruschetta al Pomodoro & Burrata",
          description: "Charcoal-grilled artisanal sourdough, marinated heirloom cherry tomatoes, torn basil, reduced balsamic glaze.",
          priceMinor: 24000,
          diet: "veg" as const,
          calories: 280,
          allergens: ["gluten", "dairy"],
          happyHour: true,
        },
        {
          name: "Crispy Calamari Fritti",
          description: "Lightly dredged calamari rings, pickled lemon aioli, flash-fried capers.",
          priceMinor: 36000,
          diet: "nonveg" as const,
          calories: 420,
          allergens: ["gluten", "dairy"],
          happyHour: false,
        },
      ],
    },
    {
      name: "Beverages & Craft Brews",
      description: "Artisanal coffees, sparkling sodas, and mocktails.",
      items: [
        {
          name: "Peach Basil Iced Tea",
          description: "Slow-brewed Assam black tea, white peach purée, bruised basil leaves, splash of sparkling water.",
          priceMinor: 14000,
          diet: "vegan" as const,
          bestseller: true,
          happyHour: true,
        },
        {
          name: "San Pellegrino Blood Orange (Aranciata Rossa)",
          description: "Imported Italian sparkling beverage made with Mediterranean blood oranges.",
          priceMinor: 18000,
          diet: "vegan" as const,
          happyHour: false,
        },
        {
          name: "Double Shot Espresso Romano",
          description: "Rich dark espresso extracted under 9 bars, served with a twist of fresh candied lemon peel.",
          priceMinor: 12000,
          diet: "vegan" as const,
          happyHour: true,
        },
        {
          name: "Classic Tiramisu Affogato Shake",
          description: "Double espresso poured over artisanal vanilla gelato, layered with mascarpone and chocolate dust.",
          priceMinor: 24000,
          diet: "veg" as const,
          calories: 340,
          allergens: ["dairy"],
          happyHour: true,
        },
      ],
    },
    {
      name: "Desserts",
      description: "Sweet Italian conclusions.",
      items: [
        {
          name: "Traditional Venetian Tiramisu",
          description: "Savoiardi ladyfinger biscuits dipped in espresso liqueur, whipped mascarpone cream, dark cocoa dust.",
          priceMinor: 28000,
          diet: "egg" as const,
          bestseller: true,
          special: true,
          calories: 420,
          allergens: ["dairy", "gluten", "egg"],
          happyHour: false,
        },
        {
          name: "Warm Nutella Calzone",
          description: "Folded woodfired pizza dough stuffed with molten Nutella, toasted hazelnuts, served with vanilla bean gelato.",
          priceMinor: 31000,
          diet: "veg" as const,
          bestseller: true,
          calories: 590,
          allergens: ["dairy", "gluten", "nuts"],
          happyHour: false,
        },
        {
          name: "Madagascar Vanilla Panna Cotta",
          description: "Silky set cream infused with real Madagascar vanilla beans, topped with tart wild berry coulis.",
          priceMinor: 24000,
          diet: "veg" as const,
          calories: 310,
          allergens: ["dairy"],
          happyHour: true,
        },
      ],
    },
  ];

  const createdItemMap: { [name: string]: string } = {};

  for (const [ci, catData] of menuConfig.entries()) {
    const [c] = await db
      .insert(categories)
      .values({
        restaurantId: rId,
        name: catData.name,
        description: catData.description,
        position: ci,
      })
      .returning({ id: categories.id });

    for (const [ii, it] of catData.items.entries()) {
      const [insertedItem] = await db
        .insert(items)
        .values({
          restaurantId: rId,
          categoryId: c.id,
          name: it.name,
          description: it.description,
          priceMinor: it.priceMinor,
          diet: it.diet,
          spicy: (it as any).spicy ?? 0,
          allergens: it.allergens ?? [],
          bestseller: it.bestseller ?? false,
          soldOut: false,
          special: (it as any).special ?? false,
          calories: it.calories ?? null,
          nutrition: (it as any).nutrition ?? null,
          options: (it as any).options ?? null,
          happyHour: it.happyHour ?? false,
          position: ii,
        })
        .returning({ id: items.id, name: items.name });

      createdItemMap[insertedItem.name] = insertedItem.id;
    }
  }
  console.log(`✓ Inserted ${menuConfig.length} categories and 18 signature dishes`);

  // 5. Coupons
  await db.insert(coupons).values([
    {
      restaurantId: rId,
      code: "XAI20",
      kind: "percent",
      value: 20,
      minOrderMinor: 49900,
      active: true,
      uses: 14,
      maxUses: 100,
    },
    {
      restaurantId: rId,
      code: "WELCOME50",
      kind: "amount",
      value: 5000,
      minOrderMinor: 25000,
      active: true,
      uses: 8,
      maxUses: 50,
    },
  ]);
  console.log("✓ Created discount coupons (XAI20, WELCOME50)");

  // 6. Realistic Orders (Today and Past Days)
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgoStr = new Date(Date.now() - 172800000).toISOString().slice(0, 10);

  const sampleOrders = [
    {
      day: todayStr,
      number: 1,
      ref: "XAI-101",
      table: "Table 4",
      customerName: "Rahul Sharma",
      customerPhone: "+91 98234 56789",
      note: "Extra crispy crust please",
      status: "new" as const,
      paid: false,
      couponCode: "XAI20",
      lines: [
        { itemId: createdItemMap["Margherita Classica"] ?? "1", name: "Margherita Classica", qty: 1, unitMinor: 34000, options: 'Regular (10")' },
        { itemId: createdItemMap["Truffle Parmesan Fries"] ?? "2", name: "Truffle Parmesan Fries", qty: 1, unitMinor: 22000, options: null },
      ],
      subtotalMinor: 56000,
      discountMinor: 11200,
      totalMinor: 44800,
    },
    {
      day: todayStr,
      number: 2,
      ref: "XAI-102",
      table: "Table 8",
      customerName: "Pooja Kulkarni",
      customerPhone: "+91 97654 32100",
      note: "Mild spice",
      status: "preparing" as const,
      paid: true,
      lines: [
        { itemId: createdItemMap["Burrata & Roasted Truffle Pizza"] ?? "3", name: "Burrata & Roasted Truffle Pizza", qty: 1, unitMinor: 54000, options: null },
        { itemId: createdItemMap["Peach Basil Iced Tea"] ?? "4", name: "Peach Basil Iced Tea", qty: 2, unitMinor: 14000, options: null },
      ],
      subtotalMinor: 82000,
      discountMinor: 0,
      totalMinor: 82000,
    },
    {
      day: todayStr,
      number: 3,
      ref: "XAI-103",
      table: "Table 2",
      customerName: "Aditya Verma",
      customerPhone: "+91 94220 88990",
      note: "Pack cutlery",
      status: "ready" as const,
      paid: true,
      lines: [
        { itemId: createdItemMap["Fettuccine Alfredo con Funghi"] ?? "5", name: "Fettuccine Alfredo con Funghi", qty: 1, unitMinor: 38000, options: "Grilled Herb Chicken" },
        { itemId: createdItemMap["Garlic Sourdough Dough Knots"] ?? "6", name: "Garlic Sourdough Dough Knots", qty: 1, unitMinor: 19000, options: null },
        { itemId: createdItemMap["Traditional Venetian Tiramisu"] ?? "7", name: "Traditional Venetian Tiramisu", qty: 1, unitMinor: 28000, options: null },
      ],
      subtotalMinor: 85000,
      discountMinor: 0,
      totalMinor: 85000,
    },
    {
      day: todayStr,
      number: 4,
      ref: "XAI-104",
      table: "Table 6",
      customerName: "Simran Kaur",
      customerPhone: "+91 99887 76655",
      note: null,
      status: "done" as const,
      paid: true,
      lines: [
        { itemId: createdItemMap["Diavola (Spicy Pepperoni)"] ?? "8", name: "Diavola (Spicy Pepperoni)", qty: 1, unitMinor: 48000, options: 'Regular (10")' },
        { itemId: createdItemMap["San Pellegrino Blood Orange (Aranciata Rossa)"] ?? "9", name: "San Pellegrino Blood Orange", qty: 2, unitMinor: 18000, options: null },
      ],
      subtotalMinor: 84000,
      discountMinor: 0,
      totalMinor: 84000,
    },
    {
      day: yesterdayStr,
      number: 1,
      ref: "XAI-089",
      table: "Table 3",
      customerName: "Dr. Arvind Joshi",
      customerPhone: "+91 98221 44332",
      note: null,
      status: "done" as const,
      paid: true,
      lines: [
        { itemId: createdItemMap["Margherita Classica"] ?? "1", name: "Margherita Classica", qty: 2, unitMinor: 34000, options: 'Regular (10")' },
        { itemId: createdItemMap["Warm Nutella Calzone"] ?? "10", name: "Warm Nutella Calzone", qty: 1, unitMinor: 31000, options: null },
      ],
      subtotalMinor: 99000,
      discountMinor: 0,
      totalMinor: 99000,
    },
    {
      day: twoDaysAgoStr,
      number: 1,
      ref: "XAI-075",
      table: "Table 5",
      customerName: "Meera Nair",
      customerPhone: "+91 97660 11223",
      note: "Birthday treat",
      status: "done" as const,
      paid: true,
      lines: [
        { itemId: createdItemMap["Burrata & Roasted Truffle Pizza"] ?? "3", name: "Burrata & Roasted Truffle Pizza", qty: 1, unitMinor: 54000, options: null },
        { itemId: createdItemMap["Lasagna Bolognese Tradizionale"] ?? "11", name: "Lasagna Bolognese Tradizionale", qty: 1, unitMinor: 46000, options: null },
      ],
      subtotalMinor: 100000,
      discountMinor: 0,
      totalMinor: 100000,
    },
  ];

  for (const o of sampleOrders) {
    await db.insert(orders).values({
      restaurantId: rId,
      day: o.day,
      number: o.number,
      ref: o.ref,
      table: o.table,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      note: o.note,
      lines: o.lines,
      currency: "INR",
      subtotalMinor: o.subtotalMinor,
      discountMinor: o.discountMinor,
      totalMinor: o.totalMinor,
      couponCode: o.couponCode ?? null,
      status: o.status,
      paid: o.paid,
    });
  }
  console.log(`✓ Seeded ${sampleOrders.length} live kitchen/inbox orders`);

  // 7. Live Service Requests
  await db.insert(serviceRequests).values([
    {
      restaurantId: rId,
      table: "Table 4",
      kind: "waiter",
      resolvedAt: null,
    },
    {
      restaurantId: rId,
      table: "Table 8",
      kind: "bill",
      resolvedAt: null,
    },
    {
      restaurantId: rId,
      table: "Table 2",
      kind: "waiter",
      resolvedAt: new Date(Date.now() - 15 * 60 * 1000),
    },
  ]);
  console.log("✓ Seeded table service requests (waiter calls & bill requests)");

  // 8. Guest Feedback & Ratings
  await db.insert(feedback).values([
    {
      restaurantId: rId,
      rating: 5,
      comment: "The Neapolitan Margherita pizza is hands down the best in the city. Incredible crust and sauce!",
      name: "Ananya Sharma",
      contact: "ananya@example.com",
      table: "Table 5",
    },
    {
      restaurantId: rId,
      rating: 5,
      comment: "Loved the Truffle Burrata pizza and Venetian Tiramisu. Outstanding service & vibe!",
      name: "Rohan Mehta",
      contact: "+91 98223 33445",
      table: "Table 3",
    },
    {
      restaurantId: rId,
      rating: 4,
      comment: "Food was fantastic, ordering through WhatsApp was smooth and fast.",
      name: "Priya Patil",
      table: "Table 8",
    },
    {
      restaurantId: rId,
      rating: 5,
      comment: "Crispy fries, delightful dough knots and authentic Italian espresso. 10/10!",
      name: "Vikram Sen",
      table: "Table 12",
    },
  ]);
  console.log("✓ Seeded guest reviews & 5-star ratings");

  // 9. Table Reservations
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dayAfterTomorrowStr = new Date(Date.now() + 172800000).toISOString().slice(0, 10);

  await db.insert(reservations).values([
    {
      restaurantId: rId,
      name: "Kavita Deshmukh",
      phone: "+91 98220 11223",
      email: "kavita.d@example.com",
      date: tomorrowStr,
      time: "20:00",
      partySize: 4,
      note: "Anniversary dinner, window corner table preferred.",
      status: "accepted",
    },
    {
      restaurantId: rId,
      name: "Aditya Roy",
      phone: "+91 98901 44556",
      email: "aditya.roy@example.com",
      date: tomorrowStr,
      time: "19:30",
      partySize: 6,
      note: "Family reunion. Need 1 high chair.",
      status: "pending",
    },
    {
      restaurantId: rId,
      name: "Sameer Joshi",
      phone: "+91 97654 33221",
      email: "sameer.j@example.com",
      date: dayAfterTomorrowStr,
      time: "21:00",
      partySize: 2,
      note: "Quiet table for date night.",
      status: "accepted",
    },
  ]);
  console.log("✓ Seeded table reservation bookings");

  // 10. Analytics Events (Scans, Views, WhatsApp Taps)
  const eventDays = [todayStr, yesterdayStr, twoDaysAgoStr];
  const sampleEvents = [];
  for (const d of eventDays) {
    for (let i = 0; i < 15; i++) {
      sampleEvents.push({ restaurantId: rId, type: "view" as const, day: d, meta: { table: `Table ${(i % 10) + 1}` } });
    }
    for (let i = 0; i < 8; i++) {
      sampleEvents.push({ restaurantId: rId, type: "scan" as const, day: d, meta: { table: `Table ${(i % 10) + 1}` } });
    }
    for (let i = 0; i < 5; i++) {
      sampleEvents.push({ restaurantId: rId, type: "whatsapp" as const, day: d, meta: { table: `Table ${(i % 10) + 1}` } });
    }
  }
  await db.insert(events).values(sampleEvents);
  console.log(`✓ Seeded ${sampleEvents.length} analytics events (views, scans, orders)`);

  // 11. AI Translation Dish Glossary
  await db.insert(glossaryEntries).values([
    {
      restaurantId: rId,
      term: "Fior di Latte",
      aliases: ["fior-di-latte", "fresh mozzarella"],
      explanation: "Fresh whole-milk mozzarella cheese from Italy, soft and delicate.",
    },
    {
      restaurantId: rId,
      term: "San Marzano",
      aliases: ["san marzano tomatoes"],
      explanation: "Sweet Italian plum tomatoes grown in volcanic soil near Mount Vesuvius.",
    },
    {
      restaurantId: rId,
      term: "Diavola",
      aliases: ["spicy diavola"],
      explanation: "Classic spicy Italian pizza topped with seasoned cured meat and hot chillies.",
    },
  ]);
  console.log("✓ Seeded Gemma AI dish glossary entries");

  await close();
  console.log("\n=======================================================");
  console.log(`🎉 SUCCESS: Full showcase data populated for ${TARGET_EMAIL}!`);
  console.log(`🔗 Public Page: /r/${TARGET_SLUG}`);
  console.log(`📊 Dashboard:   /dashboard`);
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("Error seeding showcase data:", err);
  process.exit(1);
});
