/**
 * Curated dish glossary — protected names that must NOT be literally translated.
 *
 * Each entry: the canonical name (as it usually appears on Indian menus), common spellings,
 * and a short plain-English explanation the translator adds for guests who don't know the dish.
 * `traps` are literal English glosses that signal a mistranslation (e.g. "Bombay Duck" is a fish).
 *
 * Edit freely — this file is the source of truth for the built-in list. Restaurants can add
 * their own entries (stored in the `glossary_entries` table) which override these by name.
 */

export type GlossaryEntry = {
  term: string;
  aliases?: string[];
  explanation: string;
  traps?: string[];
};

export const DISH_GLOSSARY: GlossaryEntry[] = [
  // Maharashtra
  { term: "Misal Pav", aliases: ["Misal"], explanation: "spicy sprouted moth-bean curry topped with crunchy farsan, served with soft bread rolls (Maharashtra)" },
  { term: "Vada Pav", aliases: ["Wada Pav"], explanation: "spiced potato fritter in a soft bread roll with chutneys (Mumbai street food)", traps: ["burger"] },
  { term: "Pav Bhaji", explanation: "buttery mashed-vegetable curry served with toasted bread rolls" },
  { term: "Poha", aliases: ["Kanda Poha"], explanation: "flattened rice cooked with onion, turmeric, peanuts and curry leaves" },
  { term: "Sabudana Khichdi", explanation: "sago pearls stir-fried with peanuts, potato and green chilli" },
  { term: "Sabudana Vada", explanation: "crisp fritters of sago pearls, potato and peanuts" },
  { term: "Thalipeeth", explanation: "spiced multigrain flatbread (Maharashtra)" },
  { term: "Puran Poli", explanation: "flatbread stuffed with sweet chana dal and jaggery" },
  { term: "Modak", explanation: "steamed rice-flour dumpling filled with coconut and jaggery" },
  { term: "Shrikhand", explanation: "sweetened strained yoghurt flavoured with saffron and cardamom" },
  { term: "Kanda Bhaji", aliases: ["Kanda Bhajji", "Onion Bhaji"], explanation: "crisp onion fritters in gram-flour batter" },
  { term: "Pithla Bhakri", aliases: ["Pithla"], explanation: "gram-flour curry served with millet flatbread" },
  { term: "Usal", explanation: "spiced sprouted-bean curry (Maharashtra)" },
  { term: "Sol Kadhi", aliases: ["Solkadhi"], explanation: "pink kokum and coconut-milk drink, served as a digestive" },
  { term: "Kombdi Vade", explanation: "Malvani chicken curry with fried rice-flour bread" },
  { term: "Bombay Duck", aliases: ["Bombil"], explanation: "a local lizardfish, usually fried crisp — it is fish, not duck", traps: ["duck"] },
  { term: "Kokum Sharbat", explanation: "tangy, cooling drink made from kokum fruit" },
  // Street food & snacks
  { term: "Pani Puri", aliases: ["Golgappa", "Puchka", "Pani Poori"], explanation: "crisp hollow puris filled with spiced tangy water, potato and chickpeas", traps: ["water bread"] },
  { term: "Bhel Puri", aliases: ["Bhel"], explanation: "puffed rice tossed with chutneys, onion and crunchy sev" },
  { term: "Sev Puri", explanation: "crisp puris topped with potato, chutneys and fine gram-flour noodles (sev)" },
  { term: "Dahi Puri", explanation: "crisp puris filled with potato, yoghurt and sweet-spicy chutneys" },
  { term: "Ragda Pattice", explanation: "potato patties topped with white-pea curry and chutneys" },
  { term: "Dabeli", explanation: "spiced potato filling in a bread roll with pomegranate and peanuts (Kutch)" },
  { term: "Samosa", explanation: "fried pastry filled with spiced potato and peas" },
  { term: "Kachori", explanation: "flaky fried pastry filled with spiced lentils" },
  { term: "Pakora", aliases: ["Pakoda", "Bhajiya"], explanation: "vegetables dipped in spiced gram-flour batter and fried" },
  { term: "Dhokla", explanation: "steamed, spongy savoury gram-flour cake (Gujarat)" },
  { term: "Khandvi", explanation: "soft rolls of gram flour and yoghurt with a mustard-seed tempering" },
  { term: "Momos", aliases: ["Momo"], explanation: "steamed dumplings with a vegetable or meat filling (Himalayan)" },
  // South Indian
  { term: "Masala Dosa", explanation: "thin, crisp fermented rice-and-lentil crepe filled with spiced potato" },
  { term: "Dosa", aliases: ["Plain Dosa"], explanation: "thin, crisp crepe of fermented rice and lentils" },
  { term: "Idli", explanation: "soft steamed cakes of fermented rice and lentils" },
  { term: "Medu Vada", aliases: ["Medu Wada"], explanation: "crisp savoury lentil doughnut" },
  { term: "Uttapam", aliases: ["Uthappam"], explanation: "thick rice-and-lentil pancake with onion and tomato on top" },
  { term: "Upma", explanation: "savoury semolina porridge with vegetables and tempered spices" },
  { term: "Sambar", aliases: ["Sambhar"], explanation: "lentil and vegetable stew with tamarind" },
  { term: "Rasam", explanation: "thin, peppery tamarind-tomato soup" },
  { term: "Chicken 65", explanation: "spicy, deep-fried chicken bites (Chennai)" },
  // North Indian mains
  { term: "Paneer Tikka", explanation: "cubes of Indian cottage cheese marinated in spiced yoghurt and grilled in a tandoor" },
  { term: "Paneer Butter Masala", explanation: "Indian cottage cheese in a rich tomato, butter and cream gravy" },
  { term: "Palak Paneer", explanation: "Indian cottage cheese in a spiced spinach purée" },
  { term: "Kadai Paneer", aliases: ["Kadhai Paneer"], explanation: "Indian cottage cheese with peppers in a spicy wok-tossed masala" },
  { term: "Dal Makhani", explanation: "black lentils and kidney beans slow-cooked with butter and cream" },
  { term: "Dal Tadka", aliases: ["Dal Fry"], explanation: "yellow lentils tempered with ghee, cumin, garlic and chilli" },
  { term: "Chole Bhature", aliases: ["Chhole Bhature"], explanation: "spiced chickpea curry with large puffed fried bread" },
  { term: "Rajma Chawal", explanation: "kidney-bean curry with steamed rice" },
  { term: "Butter Chicken", aliases: ["Murgh Makhani"], explanation: "tandoori chicken in a mild tomato, butter and cream gravy" },
  { term: "Chicken Tikka", explanation: "boneless chicken marinated in spiced yoghurt and grilled in a tandoor" },
  { term: "Tandoori Chicken", explanation: "chicken marinated in yoghurt and spices, roasted in a clay oven (tandoor)" },
  { term: "Rogan Josh", explanation: "Kashmiri lamb curry with aromatic red chilli" },
  { term: "Vindaloo", explanation: "hot and tangy Goan curry made with vinegar and chilli" },
  { term: "Korma", explanation: "mild, creamy curry with yoghurt, nuts and gentle spices" },
  { term: "Biryani", aliases: ["Biriyani"], explanation: "fragrant rice layered and slow-cooked with spices and meat or vegetables" },
  { term: "Pulao", aliases: ["Pulav"], explanation: "lightly spiced rice cooked with vegetables" },
  { term: "Khichdi", aliases: ["Khichadi"], explanation: "comforting dish of rice and lentils cooked together" },
  { term: "Thali", explanation: "a platter of several small dishes with rice and bread, served together" },
  // Breads & sides
  { term: "Aloo Paratha", explanation: "wholewheat flatbread stuffed with spiced potato" },
  { term: "Naan", explanation: "soft leavened flatbread baked in a tandoor" },
  { term: "Roti", aliases: ["Chapati", "Phulka"], explanation: "thin wholewheat flatbread" },
  { term: "Kulcha", explanation: "soft leavened flatbread, often stuffed, baked in a tandoor" },
  { term: "Thepla", explanation: "soft spiced flatbread with fenugreek leaves (Gujarat)" },
  { term: "Raita", explanation: "yoghurt with cucumber or crisp gram-flour pearls, lightly spiced" },
  // Drinks & sweets
  { term: "Masala Chai", aliases: ["Chai", "Cutting Chai"], explanation: "tea simmered with milk and spices such as ginger and cardamom" },
  { term: "Lassi", explanation: "churned yoghurt drink, sweet or salted" },
  { term: "Gulab Jamun", explanation: "fried milk-solid dumplings soaked in rose and cardamom syrup" },
  { term: "Jalebi", explanation: "spirals of fried batter soaked in saffron syrup" },
  { term: "Rasgulla", aliases: ["Rasagola"], explanation: "soft cottage-cheese balls in light sugar syrup" },
  { term: "Kulfi", explanation: "dense traditional Indian ice cream, often pistachio or saffron" },
  { term: "Gajar Halwa", aliases: ["Gajar ka Halwa"], explanation: "slow-cooked carrot pudding with milk, ghee and nuts" },
  { term: "Kheer", explanation: "rice pudding with milk, cardamom and nuts" },
];
