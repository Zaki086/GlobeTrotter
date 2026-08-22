import type { ActivityType } from '@prisma/client';

/**
 * India destination catalog — real cities, real coordinates, real attractions.
 *
 * This replaces the generic world dataset. Everything here is a place you can
 * actually go: coordinates are the city centre, and every activity is a real
 * site, trek, market or experience at that destination.
 *
 * `costIndex` is scaled *within India* (0-100) rather than globally, so the
 * cost filter stays useful: Mumbai ~85, a Himalayan village ~20. Prices are in
 * INR and reflect typical Indian entry fees and tour rates — foreign-national
 * ticket prices at ASI monuments are higher than the Indian-citizen rate, so
 * these sit near the higher band where the two differ.
 *
 * Timezone is Asia/Kolkata everywhere — India runs a single zone (IST).
 */

export interface SeedActivity {
  name: string;
  type: ActivityType;
  description: string;
  estimatedCost: number;
  durationMinutes: number;
  popularity: number;
}

export interface SeedCity {
  name: string;
  state: string;
  region: string;
  latitude: number;
  longitude: number;
  costIndex: number;
  popularity: number;
  description: string;
  activities: SeedActivity[];
  /** Nightly room rates in INR, overriding the cost-index derivation. */
  rates?: { budget: number; mid: number; luxury: number };
  /** Months (1-12) when the destination is in demand. */
  peakMonths?: number[];
}

/**
 * Nightly room rates and daily food budgets, derived from the city's cost
 * index when a city does not state its own.
 *
 * The curve is deliberately non-linear: budget beds bottom out around ₹800
 * almost anywhere in India, while the top end rises steeply in the metros and
 * in the heritage-hotel towns. A city can override any of it via `rates`.
 */
export function ratesFor(city: SeedCity): {
  stayBudget: number;
  stayMid: number;
  stayLuxury: number;
  mealBudget: number;
  mealMid: number;
  mealLuxury: number;
} {
  const i = city.costIndex;

  const stayBudget = city.rates?.budget ?? Math.round(700 + i * 14);
  const stayMid = city.rates?.mid ?? Math.round(1600 + i * 46);
  const stayLuxury = city.rates?.luxury ?? Math.round(4500 + i * 165);

  return {
    stayBudget,
    stayMid,
    stayLuxury,
    // Food scales far more gently than rooms — street food costs much the
    // same in Jaipur as in Mumbai.
    mealBudget: Math.round(220 + i * 3.2),
    mealMid: Math.round(500 + i * 8.5),
    mealLuxury: Math.round(1200 + i * 24),
  };
}

/**
 * When each region is in season. Rajasthan and the plains are winter
 * destinations; the Himalaya and Ladakh are summer ones; the Western Ghats and
 * the coast fill up after the monsoon clears.
 */
export const REGION_PEAK_MONTHS: Record<string, number[]> = {
  'North India': [10, 11, 12, 1, 2, 3],
  'West India': [11, 12, 1, 2],
  'South India': [11, 12, 1, 2, 3],
  'East India': [10, 11, 12, 1, 2],
  'Central India': [10, 11, 12, 1, 2],
  'Northeast India': [10, 11, 3, 4],
  Himalayas: [4, 5, 6, 9, 10],
  Islands: [11, 12, 1, 2, 3],
};

const TZ = 'Asia/Kolkata';
export const INDIA_TIMEZONE = TZ;
export const INDIA_CURRENCY = 'INR';

export const indiaCities: SeedCity[] = [
  // =========================================================================
  // North India — Delhi, Rajasthan, Punjab, UP
  // =========================================================================
  {
    name: 'New Delhi',
    state: 'Delhi',
    region: 'North India',
    latitude: 28.6139,
    longitude: 77.209,
    costIndex: 72,
    popularity: 96,
    description:
      'The capital, where Mughal tombs, a colonial-era grid and one of the busiest bazaars in Asia sit within a few metro stops of each other.',
    activities: [
      { name: 'Red Fort (Lal Qila)', type: 'CULTURE', description: 'Shah Jahan\'s red sandstone fort of 1648, the seat of Mughal power for two centuries.', estimatedCost: 600, durationMinutes: 150, popularity: 94 },
      { name: 'Humayun\'s Tomb', type: 'CULTURE', description: 'The garden tomb that set the template the Taj Mahal would later perfect.', estimatedCost: 600, durationMinutes: 120, popularity: 90 },
      { name: 'Qutub Minar complex', type: 'CULTURE', description: 'A 73m victory tower of 1193 beside an iron pillar that has resisted rust for 1,600 years.', estimatedCost: 600, durationMinutes: 105, popularity: 88 },
      { name: 'Chandni Chowk food walk', type: 'FOOD', description: 'Parathe Wali Gali, jalebi at Old Famous, and kebabs near Jama Masjid.', estimatedCost: 900, durationMinutes: 180, popularity: 92 },
      { name: 'Akshardham temple complex', type: 'CULTURE', description: 'Carved sandstone and marble mandir with a stepwell-style courtyard; no phones inside.', estimatedCost: 250, durationMinutes: 180, popularity: 85 },
    ],
  },
  {
    name: 'Agra',
    state: 'Uttar Pradesh',
    region: 'North India',
    latitude: 27.1767,
    longitude: 78.0081,
    costIndex: 45,
    popularity: 97,
    description:
      'Home to the Taj Mahal and two more UNESCO sites, on the banks of the Yamuna three hours south of Delhi.',
    activities: [
      { name: 'Taj Mahal at sunrise', type: 'CULTURE', description: 'The marble mausoleum Shah Jahan built for Mumtaz Mahal. Closed Fridays; go at opening.', estimatedCost: 1300, durationMinutes: 180, popularity: 99 },
      { name: 'Agra Fort', type: 'CULTURE', description: 'The walled Mughal city where Shah Jahan was imprisoned, with the Taj visible downriver.', estimatedCost: 650, durationMinutes: 120, popularity: 90 },
      { name: 'Mehtab Bagh at sunset', type: 'SIGHTSEEING', description: 'The riverside garden directly opposite the Taj — the classic reflection view.', estimatedCost: 300, durationMinutes: 90, popularity: 82 },
      { name: 'Fatehpur Sikri day trip', type: 'CULTURE', description: 'Akbar\'s abandoned capital of red sandstone, 40km west, deserted after 14 years.', estimatedCost: 650, durationMinutes: 240, popularity: 80 },
      { name: 'Marble inlay (pietra dura) workshop', type: 'CULTURE', description: 'Watch descendants of the Taj artisans set semi-precious stone into marble.', estimatedCost: 500, durationMinutes: 90, popularity: 68 },
    ],
  },
  {
    name: 'Jaipur',
    state: 'Rajasthan',
    region: 'North India',
    latitude: 26.9124,
    longitude: 75.7873,
    costIndex: 48,
    popularity: 93,
    description:
      'The Pink City — a planned 18th-century capital of palaces, hilltop forts, block-printed textiles and gemstone bazaars.',
    activities: [
      { name: 'Amber Fort and Sheesh Mahal', type: 'CULTURE', description: 'Hilltop fort-palace above Maota Lake, with a hall of mirrors lit by a single flame.', estimatedCost: 550, durationMinutes: 180, popularity: 93 },
      { name: 'Hawa Mahal and old city bazaars', type: 'SIGHTSEEING', description: 'The 953-window Palace of Winds, then Johari and Bapu bazaars for jewellery and textiles.', estimatedCost: 200, durationMinutes: 150, popularity: 88 },
      { name: 'City Palace and Jantar Mantar', type: 'CULTURE', description: 'The royal residence, then the 18th-century observatory with the world\'s largest stone sundial.', estimatedCost: 700, durationMinutes: 180, popularity: 85 },
      { name: 'Nahargarh Fort at sunset', type: 'SIGHTSEEING', description: 'Ramparts on the Aravalli ridge looking down over the whole pink grid.', estimatedCost: 200, durationMinutes: 120, popularity: 84 },
      { name: 'Block printing workshop in Sanganer', type: 'CULTURE', description: 'Carve and print with hand-cut wooden blocks alongside working artisans.', estimatedCost: 1200, durationMinutes: 180, popularity: 70 },
    ],
  },
  {
    name: 'Udaipur',
    state: 'Rajasthan',
    region: 'North India',
    latitude: 24.5854,
    longitude: 73.7125,
    costIndex: 52,
    popularity: 90,
    description:
      'The City of Lakes, built around Pichola with white palaces rising straight out of the water.',
    activities: [
      { name: 'City Palace complex', type: 'CULTURE', description: 'Four centuries of additions by successive Mewar rulers, above Lake Pichola.', estimatedCost: 400, durationMinutes: 180, popularity: 92 },
      { name: 'Lake Pichola sunset boat ride', type: 'SIGHTSEEING', description: 'Past Jag Mandir and the Lake Palace as the ghats turn gold.', estimatedCost: 700, durationMinutes: 60, popularity: 91 },
      { name: 'Saheliyon-ki-Bari gardens', type: 'NATURE', description: 'The Garden of the Maidens — lotus pools, marble pavilions and fountains.', estimatedCost: 100, durationMinutes: 75, popularity: 74 },
      { name: 'Bagore-ki-Haveli folk dance', type: 'CULTURE', description: 'Rajasthani dance and puppetry each evening in a restored haveli on the ghats.', estimatedCost: 200, durationMinutes: 90, popularity: 78 },
      { name: 'Kumbhalgarh Fort day trip', type: 'CULTURE', description: 'A 36km perimeter wall, second only to the Great Wall, two hours north.', estimatedCost: 1500, durationMinutes: 420, popularity: 77 },
    ],
  },
  {
    name: 'Jodhpur',
    state: 'Rajasthan',
    region: 'North India',
    latitude: 26.2389,
    longitude: 73.0243,
    costIndex: 42,
    popularity: 85,
    description:
      'The Blue City, a maze of indigo houses under the sheer walls of Mehrangarh at the edge of the Thar.',
    activities: [
      { name: 'Mehrangarh Fort', type: 'CULTURE', description: 'One of India\'s largest forts, on a 125m cliff, with cannonball scars still in the gates.', estimatedCost: 600, durationMinutes: 180, popularity: 94 },
      { name: 'Blue city walk in Navchokiya', type: 'SIGHTSEEING', description: 'The oldest indigo lanes below the fort, quieter than the clock tower side.', estimatedCost: 0, durationMinutes: 120, popularity: 82 },
      { name: 'Jaswant Thada cenotaph', type: 'CULTURE', description: 'Translucent marble memorial above a lake, a short walk from the fort.', estimatedCost: 50, durationMinutes: 60, popularity: 75 },
      { name: 'Flying Fox zipline over the fort', type: 'ADVENTURE', description: 'Six ziplines across the Mehrangarh ramparts and Rao Jodha park.', estimatedCost: 2200, durationMinutes: 120, popularity: 72 },
      { name: 'Rajasthani thali at a rooftop', type: 'FOOD', description: 'Dal baati churma, gatte ki sabzi and ker sangri with the fort lit above.', estimatedCost: 600, durationMinutes: 90, popularity: 80 },
    ],
  },
  {
    name: 'Jaisalmer',
    state: 'Rajasthan',
    region: 'North India',
    latitude: 26.9157,
    longitude: 70.9083,
    costIndex: 38,
    popularity: 82,
    description:
      'A golden sandstone fort city in the Thar Desert, and one of very few forts anywhere still lived in.',
    activities: [
      { name: 'Jaisalmer Fort (Sonar Quila)', type: 'CULTURE', description: 'A living fort — roughly a quarter of the old city still lives inside the walls.', estimatedCost: 250, durationMinutes: 150, popularity: 92 },
      { name: 'Sam sand dunes camel safari', type: 'ADVENTURE', description: 'Sunset ride into the dunes 40km west, with a desert camp and folk music after.', estimatedCost: 2500, durationMinutes: 300, popularity: 90 },
      { name: 'Patwon ki Haveli', type: 'CULTURE', description: 'Five merchant mansions with the most intricate jharokha carving in Rajasthan.', estimatedCost: 250, durationMinutes: 75, popularity: 78 },
      { name: 'Gadisar Lake at dawn', type: 'NATURE', description: 'A 14th-century reservoir ringed by ghats and shrines, full of migratory birds in winter.', estimatedCost: 0, durationMinutes: 60, popularity: 72 },
      { name: 'Kuldhara abandoned village', type: 'SIGHTSEEING', description: 'A Paliwal Brahmin village emptied overnight in 1825 and never resettled.', estimatedCost: 100, durationMinutes: 120, popularity: 68 },
    ],
  },
  {
    name: 'Pushkar',
    state: 'Rajasthan',
    region: 'North India',
    latitude: 26.4899,
    longitude: 74.5511,
    costIndex: 32,
    popularity: 76,
    description:
      'A lakeside pilgrimage town around one of the world\'s few temples to Brahma, famous for its November camel fair.',
    activities: [
      { name: 'Pushkar Lake ghats at sunrise', type: 'CULTURE', description: 'Fifty-two ghats around a sacred lake; remove shoes and skip the "puja" touts.', estimatedCost: 0, durationMinutes: 90, popularity: 85 },
      { name: 'Brahma Temple', type: 'CULTURE', description: 'A 14th-century temple to Brahma — a rarity anywhere in India.', estimatedCost: 0, durationMinutes: 60, popularity: 80 },
      { name: 'Savitri Temple ropeway', type: 'SIGHTSEEING', description: 'Cable car up the hill for the full view over lake, town and desert.', estimatedCost: 140, durationMinutes: 90, popularity: 74 },
      { name: 'Desert camel ride at sunset', type: 'ADVENTURE', description: 'An hour into the low dunes just beyond the town edge.', estimatedCost: 800, durationMinutes: 90, popularity: 72 },
    ],
  },
  {
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    region: 'North India',
    latitude: 25.3176,
    longitude: 82.9739,
    costIndex: 35,
    popularity: 91,
    description:
      'One of the oldest continuously inhabited cities on earth, arranged along 88 ghats on the west bank of the Ganges.',
    activities: [
      { name: 'Sunrise boat ride on the Ganges', type: 'SIGHTSEEING', description: 'Push off at first light to watch the ghats wake — the definitive Varanasi hour.', estimatedCost: 700, durationMinutes: 90, popularity: 96 },
      { name: 'Ganga Aarti at Dashashwamedh Ghat', type: 'CULTURE', description: 'The nightly fire ceremony, best watched from a boat rather than the crush onshore.', estimatedCost: 400, durationMinutes: 90, popularity: 94 },
      { name: 'Kashi Vishwanath Temple', type: 'CULTURE', description: 'One of the twelve Jyotirlingas, at the heart of the newly opened corridor.', estimatedCost: 0, durationMinutes: 120, popularity: 88 },
      { name: 'Sarnath excursion', type: 'CULTURE', description: 'Where the Buddha gave his first sermon; the Dhamek Stupa and museum, 10km north.', estimatedCost: 300, durationMinutes: 180, popularity: 82 },
      { name: 'Old city gali walk with kachori sabzi', type: 'FOOD', description: 'Breakfast in the lanes behind the ghats, ending with a clay cup of malaiyo in winter.', estimatedCost: 400, durationMinutes: 150, popularity: 80 },
    ],
  },
  {
    name: 'Amritsar',
    state: 'Punjab',
    region: 'North India',
    latitude: 31.634,
    longitude: 74.8723,
    costIndex: 38,
    popularity: 86,
    description:
      'The spiritual centre of Sikhism, built around the Golden Temple and its community kitchen that feeds tens of thousands daily.',
    activities: [
      { name: 'Golden Temple (Harmandir Sahib)', type: 'CULTURE', description: 'Gilded gurdwara in the middle of the Amrit Sarovar tank. Open all night; cover your head.', estimatedCost: 0, durationMinutes: 150, popularity: 97 },
      { name: 'Langar hall volunteering', type: 'CULTURE', description: 'Help serve or wash up in the world\'s largest free kitchen — around 100,000 meals a day.', estimatedCost: 0, durationMinutes: 120, popularity: 84 },
      { name: 'Jallianwala Bagh memorial', type: 'CULTURE', description: 'The walled garden of the 1919 massacre; bullet marks are still in the brickwork.', estimatedCost: 0, durationMinutes: 60, popularity: 86 },
      { name: 'Wagah border retreat ceremony', type: 'CULTURE', description: 'The daily flag-lowering drill at the Pakistan border, 30km west. Arrive early for a seat.', estimatedCost: 600, durationMinutes: 240, popularity: 88 },
      { name: 'Amritsari kulcha and lassi crawl', type: 'FOOD', description: 'Stuffed kulcha with chole, then a sweet lassi thick enough to stand a spoon in.', estimatedCost: 350, durationMinutes: 120, popularity: 82 },
    ],
  },
  {
    name: 'Rishikesh',
    state: 'Uttarakhand',
    region: 'Himalayas',
    latitude: 30.0869,
    longitude: 78.2676,
    costIndex: 34,
    popularity: 87,
    description:
      'Where the Ganges leaves the Himalaya — ashrams, whitewater and suspension bridges, and no alcohol or meat in the old town.',
    activities: [
      { name: 'Ganga rafting, Shivpuri to Rishikesh', type: 'ADVENTURE', description: 'A 16km Grade III run through Roller Coaster and Golf Course rapids.', estimatedCost: 1200, durationMinutes: 240, popularity: 93 },
      { name: 'Triveni Ghat evening aarti', type: 'CULTURE', description: 'Lamps floated onto the river at dusk, less crowded than Haridwar\'s.', estimatedCost: 0, durationMinutes: 75, popularity: 86 },
      { name: 'Beatles Ashram (Chaurasi Kutia)', type: 'CULTURE', description: 'The overgrown Maharishi ashram where the White Album was largely written.', estimatedCost: 600, durationMinutes: 120, popularity: 82 },
      { name: 'Morning yoga and meditation class', type: 'RELAXATION', description: 'Drop-in hatha session at a riverside shala, most start around 7am.', estimatedCost: 500, durationMinutes: 90, popularity: 84 },
      { name: 'Neer Garh waterfall walk', type: 'NATURE', description: 'A short forest climb to a three-tier fall with a pool at the base.', estimatedCost: 100, durationMinutes: 150, popularity: 70 },
    ],
  },
  {
    name: 'Shimla',
    state: 'Himachal Pradesh',
    region: 'Himalayas',
    latitude: 31.1048,
    longitude: 77.1734,
    costIndex: 46,
    popularity: 80,
    description:
      'The summer capital of the Raj, strung along a ridge at 2,200m and still reached by a UNESCO-listed toy train.',
    activities: [
      { name: 'Kalka–Shimla toy train', type: 'TRANSPORT', description: 'A narrow-gauge climb through 102 tunnels and 800 bridges, five hours of it.', estimatedCost: 800, durationMinutes: 330, popularity: 90 },
      { name: 'The Ridge and Mall Road', type: 'SIGHTSEEING', description: 'Christ Church, colonial facades, and the whole Himalayan skyline on a clear day.', estimatedCost: 0, durationMinutes: 120, popularity: 84 },
      { name: 'Jakhoo Temple and ropeway', type: 'CULTURE', description: 'A 108-foot Hanuman statue at the highest point in town — mind the monkeys.', estimatedCost: 500, durationMinutes: 120, popularity: 78 },
      { name: 'Kufri day trip', type: 'NATURE', description: 'Meadows and pony trails 16km out, with snow from December to March.', estimatedCost: 900, durationMinutes: 300, popularity: 72 },
    ],
  },
  {
    name: 'Manali',
    state: 'Himachal Pradesh',
    region: 'Himalayas',
    latitude: 32.2432,
    longitude: 77.1892,
    costIndex: 44,
    popularity: 88,
    description:
      'A Kullu valley town at 2,050m that doubles as the trailhead for Spiti, Lahaul and the Leh highway.',
    activities: [
      { name: 'Solang Valley paragliding', type: 'ADVENTURE', description: 'Tandem flights over the valley, plus zorbing and a ropeway in season.', estimatedCost: 2500, durationMinutes: 150, popularity: 89 },
      { name: 'Hadimba Devi Temple', type: 'CULTURE', description: 'A 1553 cedar-wood temple in a deodar grove, built over a boulder shrine.', estimatedCost: 0, durationMinutes: 75, popularity: 82 },
      { name: 'Old Manali cafés and Manu Temple', type: 'FOOD', description: 'Apple orchards, slate roofs and a long run of riverside cafés.', estimatedCost: 600, durationMinutes: 150, popularity: 80 },
      { name: 'Atal Tunnel and Sissu', type: 'SIGHTSEEING', description: 'The 9.02km tunnel under Rohtang into Lahaul, opening a valley once cut off half the year.', estimatedCost: 2200, durationMinutes: 360, popularity: 85 },
      { name: 'Vashisht hot springs', type: 'RELAXATION', description: 'Natural sulphur baths in a village across the Beas.', estimatedCost: 0, durationMinutes: 90, popularity: 74 },
    ],
  },
  {
    name: 'Leh',
    state: 'Ladakh',
    region: 'Himalayas',
    latitude: 34.1526,
    longitude: 77.5771,
    costIndex: 50,
    popularity: 89,
    description:
      'A high-desert town at 3,500m ringed by the Zanskar and Ladakh ranges. Allow two days to acclimatise before doing anything strenuous.',
    activities: [
      { name: 'Pangong Tso day trip', type: 'NATURE', description: 'A 134km lake at 4,350m that shifts blue to green through the day; permits required.', estimatedCost: 4500, durationMinutes: 600, popularity: 95 },
      { name: 'Nubra Valley over Khardung La', type: 'ADVENTURE', description: 'One of the world\'s highest motorable passes, down to sand dunes and double-humped camels.', estimatedCost: 6000, durationMinutes: 900, popularity: 92 },
      { name: 'Thiksey Monastery at dawn prayers', type: 'CULTURE', description: 'A twelve-storey gompa resembling the Potala, with a 15m Maitreya Buddha.', estimatedCost: 100, durationMinutes: 150, popularity: 88 },
      { name: 'Leh Palace and old town', type: 'CULTURE', description: 'The 17th-century nine-storey palace above the bazaar, with the Stok range opposite.', estimatedCost: 300, durationMinutes: 120, popularity: 80 },
      { name: 'Hemis Monastery', type: 'CULTURE', description: 'The largest and wealthiest gompa in Ladakh, 45km south, famous for its June festival.', estimatedCost: 150, durationMinutes: 210, popularity: 78 },
    ],
  },
  {
    name: 'Srinagar',
    state: 'Jammu and Kashmir',
    region: 'Himalayas',
    latitude: 34.0837,
    longitude: 74.7973,
    costIndex: 44,
    popularity: 85,
    description:
      'Built around Dal Lake, with Mughal gardens on the shore and houseboats that have been let to travellers since the 1880s.',
    activities: [
      { name: 'Shikara ride on Dal Lake', type: 'SIGHTSEEING', description: 'A slow paddle past floating gardens and the vegetable market that trades at dawn.', estimatedCost: 800, durationMinutes: 90, popularity: 94 },
      { name: 'Mughal gardens: Shalimar and Nishat', type: 'NATURE', description: 'Terraced Persian-style gardens laid out by Jahangir and Asaf Khan.', estimatedCost: 100, durationMinutes: 180, popularity: 86 },
      { name: 'Gulmarg Gondola', type: 'ADVENTURE', description: 'One of the highest cable cars in the world, to 3,980m on Apharwat.', estimatedCost: 1700, durationMinutes: 420, popularity: 90 },
      { name: 'Night on a Dal Lake houseboat', type: 'RELAXATION', description: 'Carved cedar interiors, kahwa on the veranda, and the lake completely still at dawn.', estimatedCost: 3000, durationMinutes: 720, popularity: 88 },
      { name: 'Old city and Jamia Masjid', type: 'CULTURE', description: 'A 1394 mosque on 378 deodar pillars, then the papier-mâché and copper workshops.', estimatedCost: 0, durationMinutes: 150, popularity: 76 },
    ],
  },
  {
    name: 'Nainital',
    state: 'Uttarakhand',
    region: 'Himalayas',
    latitude: 29.3803,
    longitude: 79.4636,
    costIndex: 40,
    popularity: 74,
    description:
      'A Kumaon hill station wrapped around a pear-shaped glacial lake at 2,084m.',
    activities: [
      { name: 'Naini Lake boating', type: 'SIGHTSEEING', description: 'Yellow-sailed boats across the lake, with the Mall on one shore and forest on the other.', estimatedCost: 400, durationMinutes: 60, popularity: 84 },
      { name: 'Snow View Point ropeway', type: 'SIGHTSEEING', description: 'Cable car to 2,270m for Nanda Devi and Trishul on a clear morning.', estimatedCost: 350, durationMinutes: 120, popularity: 78 },
      { name: 'Naina Devi Temple', type: 'CULTURE', description: 'A Shakti Peetha on the north shore, rebuilt after the 1880 landslide.', estimatedCost: 0, durationMinutes: 60, popularity: 72 },
      { name: 'Tiffin Top hike', type: 'ADVENTURE', description: 'A four-kilometre walk or pony ride through oak to a 360-degree outcrop.', estimatedCost: 200, durationMinutes: 180, popularity: 70 },
    ],
  },
  {
    name: 'Jim Corbett (Ramnagar)',
    state: 'Uttarakhand',
    region: 'North India',
    latitude: 29.3919,
    longitude: 79.1288,
    costIndex: 42,
    popularity: 78,
    description:
      'India\'s oldest national park, established 1936, and the birthplace of Project Tiger.',
    activities: [
      { name: 'Dhikala zone jeep safari', type: 'NATURE', description: 'The core zone — grasslands, elephants, and the best tiger odds. Book well ahead.', estimatedCost: 6000, durationMinutes: 240, popularity: 92 },
      { name: 'Bijrani zone morning safari', type: 'NATURE', description: 'Sal forest and open chaurs, easier to book than Dhikala.', estimatedCost: 4500, durationMinutes: 210, popularity: 84 },
      { name: 'Corbett Falls forest walk', type: 'NATURE', description: 'A 20m fall reached through dense teak, quiet on weekdays.', estimatedCost: 100, durationMinutes: 120, popularity: 68 },
      { name: 'Kosi river birding', type: 'NATURE', description: 'Ibisbill and wallcreeper in winter along the riverbed outside the park gates.', estimatedCost: 800, durationMinutes: 180, popularity: 66 },
    ],
  },

  // =========================================================================
  // West India — Maharashtra, Gujarat, Goa
  // =========================================================================
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    region: 'West India',
    latitude: 19.076,
    longitude: 72.8777,
    costIndex: 85,
    popularity: 94,
    description:
      'India\'s financial capital and the home of Hindi cinema — Art Deco and Gothic Revival on the same seafront, and the country\'s densest street food culture.',
    activities: [
      { name: 'Gateway of India and Colaba', type: 'SIGHTSEEING', description: 'The 1924 basalt arch on the harbour, then the causeway\'s bookstalls and cafés.', estimatedCost: 0, durationMinutes: 120, popularity: 90 },
      { name: 'Elephanta Caves by ferry', type: 'CULTURE', description: 'Rock-cut Shiva temples on an island an hour offshore; the Trimurti is 6m tall.', estimatedCost: 800, durationMinutes: 300, popularity: 86 },
      { name: 'Dharavi community walk', type: 'CULTURE', description: 'A guided, no-photography walk through the recycling and leather workshops.', estimatedCost: 1200, durationMinutes: 180, popularity: 78 },
      { name: 'Marine Drive and Chowpatty at dusk', type: 'SIGHTSEEING', description: 'The Queen\'s Necklace curve, ending with bhelpuri on the sand.', estimatedCost: 200, durationMinutes: 120, popularity: 88 },
      { name: 'Chhatrapati Shivaji Terminus and Crawford Market', type: 'CULTURE', description: 'UNESCO-listed Victorian Gothic, then the 1869 market hall behind it.', estimatedCost: 0, durationMinutes: 150, popularity: 82 },
    ],
  },
  {
    name: 'Goa (Panaji)',
    state: 'Goa',
    region: 'West India',
    latitude: 15.4909,
    longitude: 73.8278,
    costIndex: 58,
    popularity: 92,
    description:
      'Portuguese-era churches and azulejo-tiled houses inland, and 100km of Arabian Sea beach from Arambol down to Palolem.',
    activities: [
      { name: 'Old Goa churches', type: 'CULTURE', description: 'Basilica of Bom Jesus, holding St Francis Xavier, and the Sé Cathedral opposite.', estimatedCost: 0, durationMinutes: 150, popularity: 86 },
      { name: 'Fontainhas Latin Quarter walk', type: 'SIGHTSEEING', description: 'Ochre and indigo houses, Portuguese street names, and a working bakery on most corners.', estimatedCost: 0, durationMinutes: 120, popularity: 80 },
      { name: 'Dudhsagar Falls jeep trip', type: 'NATURE', description: 'A 310m four-tier fall on the Mandovi, best just after the monsoon.', estimatedCost: 2500, durationMinutes: 360, popularity: 88 },
      { name: 'Palolem beach day', type: 'RELAXATION', description: 'A calm crescent in the south, with kayaks and dolphin boats at the north end.', estimatedCost: 600, durationMinutes: 300, popularity: 90 },
      { name: 'Goan fish curry rice and feni', type: 'FOOD', description: 'Kingfish recheado, prawn balchão and cashew feni at a village taverna.', estimatedCost: 800, durationMinutes: 120, popularity: 84 },
    ],
  },
  {
    name: 'Aurangabad',
    state: 'Maharashtra',
    region: 'West India',
    latitude: 19.8762,
    longitude: 75.3433,
    costIndex: 36,
    popularity: 79,
    description:
      'The base for Ajanta and Ellora — two of the greatest rock-cut cave complexes anywhere.',
    activities: [
      { name: 'Ellora Caves', type: 'CULTURE', description: '34 Buddhist, Hindu and Jain caves; Kailasa is carved downward from a single rock.', estimatedCost: 600, durationMinutes: 300, popularity: 94 },
      { name: 'Ajanta Caves', type: 'CULTURE', description: 'Thirty 2nd-century BC Buddhist caves with the finest surviving ancient Indian painting.', estimatedCost: 600, durationMinutes: 360, popularity: 93 },
      { name: 'Bibi ka Maqbara', type: 'CULTURE', description: 'Aurangzeb\'s son\'s tomb for his mother — a smaller answer to the Taj.', estimatedCost: 300, durationMinutes: 90, popularity: 76 },
      { name: 'Daulatabad Fort climb', type: 'ADVENTURE', description: 'A hill fort with a spiral bat-filled tunnel that was designed to trap attackers.', estimatedCost: 300, durationMinutes: 180, popularity: 74 },
    ],
  },
  {
    name: 'Mount Abu',
    state: 'Rajasthan',
    region: 'West India',
    latitude: 24.5926,
    longitude: 72.7156,
    costIndex: 36,
    popularity: 70,
    description:
      'Rajasthan\'s only hill station, in the Aravallis, best known for the Dilwara Jain temples.',
    activities: [
      { name: 'Dilwara Jain temples', type: 'CULTURE', description: 'Marble carved so thin it is translucent; five temples built between 1031 and 1582.', estimatedCost: 0, durationMinutes: 120, popularity: 88 },
      { name: 'Nakki Lake boating', type: 'SIGHTSEEING', description: 'A crater lake in the middle of town, with Toad Rock above it.', estimatedCost: 300, durationMinutes: 60, popularity: 72 },
      { name: 'Guru Shikhar sunrise', type: 'NATURE', description: 'At 1,722m, the highest point in the Aravalli range.', estimatedCost: 200, durationMinutes: 150, popularity: 74 },
    ],
  },
  {
    name: 'Ahmedabad',
    state: 'Gujarat',
    region: 'West India',
    latitude: 23.0225,
    longitude: 72.5714,
    costIndex: 40,
    popularity: 75,
    description:
      'India\'s first UNESCO World Heritage City — pol houses, stepwells, and a textile trade going back six centuries.',
    activities: [
      { name: 'Heritage pol walk in the old city', type: 'CULTURE', description: 'A 6am guided walk through the walled pols, ending at Manek Chowk.', estimatedCost: 200, durationMinutes: 150, popularity: 84 },
      { name: 'Adalaj Stepwell', type: 'CULTURE', description: 'A five-storey octagonal vav of 1499, cool at the bottom even in May.', estimatedCost: 300, durationMinutes: 90, popularity: 82 },
      { name: 'Sabarmati Ashram', type: 'CULTURE', description: 'Gandhi\'s home from 1917 to 1930 and the starting point of the Dandi March.', estimatedCost: 0, durationMinutes: 90, popularity: 86 },
      { name: 'Manek Chowk night food market', type: 'FOOD', description: 'A jewellery bazaar by day that turns into a street-food market after 9pm.', estimatedCost: 350, durationMinutes: 120, popularity: 80 },
      { name: 'Calico Museum of Textiles', type: 'CULTURE', description: 'One of the world\'s finest textile collections; guided entry only, book ahead.', estimatedCost: 0, durationMinutes: 150, popularity: 70 },
    ],
  },
  {
    name: 'Bhuj (Rann of Kutch)',
    state: 'Gujarat',
    region: 'West India',
    latitude: 23.242,
    longitude: 69.6669,
    costIndex: 34,
    popularity: 72,
    description:
      'Gateway to the White Rann — a salt desert that floods each monsoon and dries to a blinding white plain by winter.',
    activities: [
      { name: 'White Rann at full moon', type: 'NATURE', description: 'The salt flats at Dhordo, 80km north; the Rann Utsav runs November to February.', estimatedCost: 1500, durationMinutes: 300, popularity: 92 },
      { name: 'Kutch craft village circuit', type: 'SHOPPING', description: 'Ajrakhpur block printing, Nirona rogan art, and Bhujodi weaving in one loop.', estimatedCost: 1800, durationMinutes: 360, popularity: 82 },
      { name: 'Aina Mahal and Prag Mahal', type: 'CULTURE', description: 'A mirrored 18th-century palace and its Italianate neighbour, both quake-scarred.', estimatedCost: 200, durationMinutes: 120, popularity: 70 },
      { name: 'Kalo Dungar viewpoint', type: 'SIGHTSEEING', description: 'The highest point in Kutch, looking out over the whole white expanse.', estimatedCost: 400, durationMinutes: 180, popularity: 74 },
    ],
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    region: 'West India',
    latitude: 18.5204,
    longitude: 73.8567,
    costIndex: 58,
    popularity: 72,
    description:
      'The Maratha capital turned university and IT city, at the foot of the Sahyadris.',
    activities: [
      { name: 'Aga Khan Palace', type: 'CULTURE', description: 'Where Gandhi and Kasturba were interned from 1942; her samadhi is in the garden.', estimatedCost: 300, durationMinutes: 90, popularity: 76 },
      { name: 'Shaniwar Wada', type: 'CULTURE', description: 'The Peshwa seat of 1732, burnt in 1828 — the gates and foundations remain.', estimatedCost: 300, durationMinutes: 75, popularity: 74 },
      { name: 'Sinhagad Fort trek', type: 'ADVENTURE', description: 'A steep two-hour climb to a hill fort, rewarded with pithla bhakri and curd at the top.', estimatedCost: 100, durationMinutes: 300, popularity: 82 },
      { name: 'Misal pav crawl', type: 'FOOD', description: 'Pune\'s signature dish — sprouted usal under farsan, with pav to mop it up.', estimatedCost: 250, durationMinutes: 90, popularity: 78 },
    ],
  },

  // =========================================================================
  // South India — Kerala, Tamil Nadu, Karnataka, Telangana
  // =========================================================================
  {
    name: 'Kochi',
    state: 'Kerala',
    region: 'South India',
    latitude: 9.9312,
    longitude: 76.2673,
    costIndex: 44,
    popularity: 86,
    description:
      'A spice port traded by the Chinese, Arabs, Portuguese, Dutch and British in turn — and every one of them left something behind.',
    activities: [
      { name: 'Chinese fishing nets at Fort Kochi', type: 'SIGHTSEEING', description: 'Cantilevered shore-operated nets, worked at dawn and dusk for six centuries.', estimatedCost: 0, durationMinutes: 90, popularity: 88 },
      { name: 'Kathakali performance', type: 'CULTURE', description: 'Arrive an hour early to watch the make-up go on — that is half the art.', estimatedCost: 500, durationMinutes: 150, popularity: 84 },
      { name: 'Mattancherry Palace and Jew Town', type: 'CULTURE', description: 'Dutch Palace murals, the Paradesi Synagogue of 1568, and antique shops along one lane.', estimatedCost: 100, durationMinutes: 150, popularity: 82 },
      { name: 'Kerala backwater canoe from Kumbalangi', type: 'NATURE', description: 'A quiet village-canal paddle, far calmer than the Alleppey houseboat route.', estimatedCost: 1200, durationMinutes: 180, popularity: 80 },
      { name: 'Toddy shop meal', type: 'FOOD', description: 'Karimeen pollichathu and beef ularthiyathu with fresh toddy, inland from the fort.', estimatedCost: 700, durationMinutes: 120, popularity: 78 },
    ],
  },
  {
    name: 'Alleppey (Alappuzha)',
    state: 'Kerala',
    region: 'South India',
    latitude: 9.4981,
    longitude: 76.3388,
    costIndex: 46,
    popularity: 88,
    description:
      'The hub of the Kerala backwaters — 900km of interlocking canals, lagoons and rice paddies below sea level.',
    activities: [
      { name: 'Overnight houseboat on Vembanad', type: 'RELAXATION', description: 'A converted kettuvallam rice barge, with a cook aboard and paddies either side.', estimatedCost: 9000, durationMinutes: 1200, popularity: 95 },
      { name: 'Shikara canal ride', type: 'SIGHTSEEING', description: 'A small boat gets into the narrow canals the houseboats cannot reach.', estimatedCost: 1200, durationMinutes: 180, popularity: 86 },
      { name: 'Marari beach day', type: 'RELAXATION', description: 'A working fishing beach 11km north, almost empty on weekdays.', estimatedCost: 300, durationMinutes: 240, popularity: 78 },
      { name: 'Snake boat (chundan vallam) visit', type: 'CULTURE', description: 'See a 100-rower racing boat in its shed; races run August to September.', estimatedCost: 200, durationMinutes: 90, popularity: 70 },
    ],
  },
  {
    name: 'Munnar',
    state: 'Kerala',
    region: 'South India',
    latitude: 10.0889,
    longitude: 77.0595,
    costIndex: 42,
    popularity: 85,
    description:
      'Tea country in the Western Ghats at 1,600m, planted by the British from the 1880s and still worked by hand.',
    activities: [
      { name: 'Tea estate walk and museum', type: 'NATURE', description: 'Through the bushes at Kolukkumalai or Lockhart, then the processing floor.', estimatedCost: 500, durationMinutes: 180, popularity: 88 },
      { name: 'Eravikulam National Park', type: 'NATURE', description: 'Home to the Nilgiri tahr; closed February–March for calving.', estimatedCost: 500, durationMinutes: 180, popularity: 86 },
      { name: 'Top Station viewpoint', type: 'SIGHTSEEING', description: 'At 1,880m on the Tamil Nadu border, above the clouds most mornings.', estimatedCost: 100, durationMinutes: 210, popularity: 80 },
      { name: 'Mattupetty Dam and echo point', type: 'NATURE', description: 'A reservoir ringed by shola forest, with pedal boats and a dairy nearby.', estimatedCost: 300, durationMinutes: 150, popularity: 74 },
    ],
  },
  {
    name: 'Thekkady (Periyar)',
    state: 'Kerala',
    region: 'South India',
    latitude: 9.5916,
    longitude: 77.1603,
    costIndex: 38,
    popularity: 76,
    description:
      'A tiger reserve built around a lake that was created by a dam in 1895 — you watch wildlife from a boat rather than a jeep.',
    activities: [
      { name: 'Periyar Lake boat safari', type: 'NATURE', description: 'Elephant and gaur come down to the shore; the first boat of the day is the best.', estimatedCost: 500, durationMinutes: 120, popularity: 88 },
      { name: 'Bamboo rafting in the reserve', type: 'ADVENTURE', description: 'A full-day guided trek and raft with forest department watchers.', estimatedCost: 2500, durationMinutes: 480, popularity: 82 },
      { name: 'Spice plantation tour', type: 'NATURE', description: 'Cardamom, pepper, clove and vanilla growing together on a hillside.', estimatedCost: 400, durationMinutes: 120, popularity: 78 },
      { name: 'Kalaripayattu demonstration', type: 'CULTURE', description: 'Kerala\'s martial art, arguably the oldest still practised anywhere.', estimatedCost: 300, durationMinutes: 75, popularity: 72 },
    ],
  },
  {
    name: 'Bengaluru',
    state: 'Karnataka',
    region: 'South India',
    latitude: 12.9716,
    longitude: 77.5946,
    costIndex: 70,
    popularity: 78,
    description:
      'India\'s tech capital at 920m, which keeps it temperate year-round — parks, breweries and one of the best food scenes in the south.',
    activities: [
      { name: 'Lalbagh Botanical Garden', type: 'NATURE', description: 'A 240-acre garden from 1760 with a glasshouse modelled on Crystal Palace.', estimatedCost: 50, durationMinutes: 120, popularity: 82 },
      { name: 'Bangalore Palace', type: 'CULTURE', description: 'A Tudor-revival pile of 1887, modelled on Windsor Castle.', estimatedCost: 500, durationMinutes: 90, popularity: 72 },
      { name: 'VV Puram food street', type: 'FOOD', description: 'One lane, dozens of stalls — holige, akki roti, and congress kadlekai.', estimatedCost: 300, durationMinutes: 120, popularity: 84 },
      { name: 'Nandi Hills sunrise', type: 'NATURE', description: 'A 60km pre-dawn drive to a hill fort that sits above the cloud line.', estimatedCost: 1200, durationMinutes: 300, popularity: 80 },
      { name: 'Filter coffee and masala dosa breakfast', type: 'FOOD', description: 'A benne dosa at a 1940s darshini, with degree coffee in a steel tumbler.', estimatedCost: 200, durationMinutes: 60, popularity: 86 },
    ],
  },
  {
    name: 'Mysuru',
    state: 'Karnataka',
    region: 'South India',
    latitude: 12.2958,
    longitude: 76.6394,
    costIndex: 38,
    popularity: 82,
    description:
      'The Wodeyar capital — a palace lit by 97,000 bulbs on Sunday nights, sandalwood, silk and yoga schools.',
    activities: [
      { name: 'Mysore Palace', type: 'CULTURE', description: 'The 1912 Indo-Saracenic palace; stay for the Sunday-evening illumination.', estimatedCost: 200, durationMinutes: 150, popularity: 94 },
      { name: 'Chamundi Hill and Nandi statue', type: 'CULTURE', description: 'A thousand steps up to the temple, past a 4.9m monolithic Nandi.', estimatedCost: 50, durationMinutes: 180, popularity: 84 },
      { name: 'Devaraja Market', type: 'SHOPPING', description: 'Pyramids of kumkum powder, jasmine by the metre, and sandalwood oil.', estimatedCost: 200, durationMinutes: 90, popularity: 78 },
      { name: 'Srirangapatna and Tipu\'s summer palace', type: 'CULTURE', description: 'The island fort where Tipu Sultan fell in 1799, 16km north.', estimatedCost: 300, durationMinutes: 210, popularity: 76 },
    ],
  },
  {
    name: 'Hampi',
    state: 'Karnataka',
    region: 'South India',
    latitude: 15.335,
    longitude: 76.462,
    costIndex: 30,
    popularity: 87,
    description:
      'The ruined capital of Vijayanagara, spread over 26 square kilometres of boulder-strewn landscape on the Tungabhadra.',
    activities: [
      { name: 'Virupaksha Temple and bazaar', type: 'CULTURE', description: 'Continuously worshipped since the 7th century, with a 50m gopuram over the ruins.', estimatedCost: 50, durationMinutes: 120, popularity: 92 },
      { name: 'Vittala Temple and stone chariot', type: 'CULTURE', description: 'The musical pillars and the chariot that is on the ₹50 note.', estimatedCost: 600, durationMinutes: 150, popularity: 94 },
      { name: 'Matanga Hill sunrise', type: 'ADVENTURE', description: 'A 20-minute scramble to the highest point over the whole ruin field.', estimatedCost: 0, durationMinutes: 120, popularity: 88 },
      { name: 'Coracle ride on the Tungabhadra', type: 'ADVENTURE', description: 'A round basket boat across to Anegundi, the older settlement opposite.', estimatedCost: 400, durationMinutes: 60, popularity: 80 },
      { name: 'Bouldering at Hampi', type: 'ADVENTURE', description: 'World-class granite problems; guides and crash pads rent in Anegundi.', estimatedCost: 1500, durationMinutes: 240, popularity: 74 },
    ],
  },
  {
    name: 'Coorg (Madikeri)',
    state: 'Karnataka',
    region: 'South India',
    latitude: 12.4244,
    longitude: 75.7382,
    costIndex: 44,
    popularity: 78,
    description:
      'Coffee country in the Western Ghats, with its own martial culture, cuisine and a river that rises in a temple tank.',
    activities: [
      { name: 'Coffee plantation stay and walk', type: 'NATURE', description: 'Arabica and robusta under shade trees, with pepper vines climbing them.', estimatedCost: 800, durationMinutes: 150, popularity: 86 },
      { name: 'Abbey Falls', type: 'NATURE', description: 'A 21m fall inside a coffee estate, thundering right after the monsoon.', estimatedCost: 100, durationMinutes: 90, popularity: 80 },
      { name: 'Talakaveri, source of the Kaveri', type: 'CULTURE', description: 'A spring in a temple tank at 1,276m, where the river begins.', estimatedCost: 50, durationMinutes: 180, popularity: 76 },
      { name: 'Dubare elephant camp', type: 'NATURE', description: 'A forest department camp on the Kaveri where the elephants are bathed each morning.', estimatedCost: 700, durationMinutes: 180, popularity: 78 },
    ],
  },
  {
    name: 'Gokarna',
    state: 'Karnataka',
    region: 'South India',
    latitude: 14.5479,
    longitude: 74.318,
    costIndex: 30,
    popularity: 74,
    description:
      'A temple town on the Karnataka coast with a string of headland-separated beaches reached only on foot.',
    activities: [
      { name: 'Beach trek: Kudle to Paradise', type: 'ADVENTURE', description: 'Four beaches over headland paths — Kudle, Om, Half Moon and Paradise.', estimatedCost: 0, durationMinutes: 240, popularity: 88 },
      { name: 'Mahabaleshwar Temple', type: 'CULTURE', description: 'The Atmalinga shrine that makes this one of the older pilgrimage towns in the south.', estimatedCost: 0, durationMinutes: 60, popularity: 78 },
      { name: 'Om Beach sunset', type: 'RELAXATION', description: 'The beach that traces the shape of the ॐ symbol, best in the last hour of light.', estimatedCost: 0, durationMinutes: 90, popularity: 84 },
    ],
  },
  {
    name: 'Chennai',
    state: 'Tamil Nadu',
    region: 'South India',
    latitude: 13.0827,
    longitude: 80.2707,
    costIndex: 55,
    popularity: 76,
    description:
      'The Tamil capital, with the second-longest urban beach in the world, Carnatic music season each December, and Dravidian temples inside the city.',
    activities: [
      { name: 'Kapaleeshwarar Temple, Mylapore', type: 'CULTURE', description: 'A 7th-century Shiva temple with a painted gopuram and a tank behind it.', estimatedCost: 0, durationMinutes: 90, popularity: 84 },
      { name: 'Marina Beach evening', type: 'SIGHTSEEING', description: 'Thirteen kilometres of sand; sundal and bajji from the carts, no swimming.', estimatedCost: 100, durationMinutes: 120, popularity: 82 },
      { name: 'Mahabalipuram day trip', type: 'CULTURE', description: 'The Shore Temple, Arjuna\'s Penance and the five rathas, 55km south. UNESCO-listed.', estimatedCost: 900, durationMinutes: 420, popularity: 90 },
      { name: 'Fort St George and San Thome', type: 'CULTURE', description: 'The first English fortress in India, 1644, and the basilica over St Thomas\'s tomb.', estimatedCost: 300, durationMinutes: 180, popularity: 72 },
      { name: 'Filter coffee and tiffin in Mylapore', type: 'FOOD', description: 'Idli, pongal and a steel tumbler of degree coffee at a decades-old mess.', estimatedCost: 200, durationMinutes: 75, popularity: 80 },
    ],
  },
  {
    name: 'Madurai',
    state: 'Tamil Nadu',
    region: 'South India',
    latitude: 9.9252,
    longitude: 78.1198,
    costIndex: 32,
    popularity: 80,
    description:
      'A temple city on the Vaigai that has been continuously inhabited for more than two millennia.',
    activities: [
      { name: 'Meenakshi Amman Temple', type: 'CULTURE', description: 'Fourteen gopurams covered in thousands of painted figures; the hall has 985 carved pillars.', estimatedCost: 50, durationMinutes: 180, popularity: 96 },
      { name: 'Night ceremony at Meenakshi', type: 'CULTURE', description: 'Shiva\'s idol carried to Meenakshi\'s chamber each night at around 9pm.', estimatedCost: 0, durationMinutes: 75, popularity: 84 },
      { name: 'Thirumalai Nayakkar Palace', type: 'CULTURE', description: 'A 1636 Indo-Saracenic hall with 25m columns; the surviving quarter of the original.', estimatedCost: 250, durationMinutes: 90, popularity: 74 },
      { name: 'Jigarthanda and street food', type: 'FOOD', description: 'A Madurai-only drink of milk, almond gum and ice cream, then kari dosa after dark.', estimatedCost: 200, durationMinutes: 90, popularity: 80 },
    ],
  },
  {
    name: 'Pondicherry',
    state: 'Puducherry',
    region: 'South India',
    latitude: 11.9416,
    longitude: 79.8083,
    costIndex: 44,
    popularity: 82,
    description:
      'A former French colony where the White Town still has bougainvillea over yellow walls, gendarme-style street signs, and boulangeries.',
    activities: [
      { name: 'French Quarter walk', type: 'SIGHTSEEING', description: 'Rue Dumas and Rue Suffren, ending at the seafront promenade.', estimatedCost: 0, durationMinutes: 120, popularity: 86 },
      { name: 'Auroville and the Matrimandir', type: 'CULTURE', description: 'An experimental township from 1968; the golden sphere needs a same-day pass.', estimatedCost: 0, durationMinutes: 210, popularity: 84 },
      { name: 'Sri Aurobindo Ashram', type: 'CULTURE', description: 'A quiet courtyard around the samadhi, in the middle of the old town.', estimatedCost: 0, durationMinutes: 60, popularity: 76 },
      { name: 'Paradise Beach by boat', type: 'RELAXATION', description: 'A sandbar reached across the Chunnambar backwater, 8km south.', estimatedCost: 400, durationMinutes: 240, popularity: 78 },
    ],
  },
  {
    name: 'Ooty (Udhagamandalam)',
    state: 'Tamil Nadu',
    region: 'South India',
    latitude: 11.4102,
    longitude: 76.695,
    costIndex: 38,
    popularity: 78,
    description:
      'The queen of the Nilgiris at 2,240m, reached by a rack railway that has been running since 1908.',
    activities: [
      { name: 'Nilgiri Mountain Railway', type: 'TRANSPORT', description: 'A UNESCO-listed rack-and-pinion climb from Mettupalayam through 208 curves.', estimatedCost: 300, durationMinutes: 290, popularity: 92 },
      { name: 'Government Botanical Garden', type: 'NATURE', description: 'Laid out in 1848 across 55 acres, with a fossilised tree trunk at the centre.', estimatedCost: 100, durationMinutes: 120, popularity: 80 },
      { name: 'Doddabetta Peak', type: 'SIGHTSEEING', description: 'The highest point in the Nilgiris at 2,637m, with a telescope house at the top.', estimatedCost: 100, durationMinutes: 120, popularity: 78 },
      { name: 'Tea factory and Coonoor', type: 'NATURE', description: 'Sim\'s Park and the Dolphin\'s Nose viewpoint, quieter than Ooty itself.', estimatedCost: 400, durationMinutes: 240, popularity: 76 },
    ],
  },
  {
    name: 'Hyderabad',
    state: 'Telangana',
    region: 'South India',
    latitude: 17.385,
    longitude: 78.4867,
    costIndex: 56,
    popularity: 80,
    description:
      'The Nizams\' city — Qutb Shahi monuments, a pearl trade, and the biryani that carries its name.',
    activities: [
      { name: 'Charminar and Laad Bazaar', type: 'CULTURE', description: 'The 1591 four-minaret gate, with the bangle bazaar radiating from its base.', estimatedCost: 250, durationMinutes: 150, popularity: 90 },
      { name: 'Golconda Fort and sound-and-light', type: 'CULTURE', description: 'A clap at the entrance carries to the hilltop pavilion — the fort\'s original alarm.', estimatedCost: 300, durationMinutes: 210, popularity: 88 },
      { name: 'Qutb Shahi Tombs', type: 'CULTURE', description: 'Seven generations of rulers in one garden necropolis, recently restored.', estimatedCost: 200, durationMinutes: 120, popularity: 78 },
      { name: 'Hyderabadi biryani and haleem', type: 'FOOD', description: 'Dum biryani cooked sealed under dough; haleem appears only during Ramzan.', estimatedCost: 500, durationMinutes: 90, popularity: 92 },
      { name: 'Chowmahalla Palace', type: 'CULTURE', description: 'The Nizams\' seat, with a 19th-century clock still wound by the same family.', estimatedCost: 200, durationMinutes: 120, popularity: 76 },
    ],
  },

  // =========================================================================
  // East & Northeast India
  // =========================================================================
  {
    name: 'Kolkata',
    state: 'West Bengal',
    region: 'East India',
    latitude: 22.5726,
    longitude: 88.3639,
    costIndex: 48,
    popularity: 83,
    description:
      'The former imperial capital — colonial palaces, coffee-house arguments, trams still running, and the best sweets in the country.',
    activities: [
      { name: 'Victoria Memorial', type: 'CULTURE', description: 'White Makrana marble in 64 acres of gardens, finished in 1921.', estimatedCost: 500, durationMinutes: 150, popularity: 90 },
      { name: 'Howrah Bridge and Mullick Ghat flower market', type: 'SIGHTSEEING', description: 'A cantilever bridge with no bolts, above a flower market that starts at 4am.', estimatedCost: 0, durationMinutes: 120, popularity: 84 },
      { name: 'Kumartuli idol-makers\' quarter', type: 'CULTURE', description: 'Clay Durga idols under construction; busiest in the weeks before Puja.', estimatedCost: 0, durationMinutes: 120, popularity: 80 },
      { name: 'College Street and Indian Coffee House', type: 'CULTURE', description: 'A kilometre of second-hand book stalls, then coffee upstairs at the Albert Hall.', estimatedCost: 200, durationMinutes: 120, popularity: 82 },
      { name: 'Bengali sweets and kathi rolls', type: 'FOOD', description: 'Nolen gur sandesh in winter, mishti doi in a clay pot, and a Park Street kathi roll.', estimatedCost: 350, durationMinutes: 120, popularity: 86 },
    ],
  },
  {
    name: 'Darjeeling',
    state: 'West Bengal',
    region: 'Himalayas',
    latitude: 27.041,
    longitude: 88.2663,
    costIndex: 40,
    popularity: 84,
    description:
      'A tea town at 2,045m with Kanchenjunga — the world\'s third-highest peak — filling the skyline on a clear morning.',
    activities: [
      { name: 'Tiger Hill sunrise over Kanchenjunga', type: 'SIGHTSEEING', description: 'A 4am start; on the clearest days Everest is visible far to the west.', estimatedCost: 500, durationMinutes: 240, popularity: 94 },
      { name: 'Darjeeling Himalayan Railway joy ride', type: 'TRANSPORT', description: 'The UNESCO-listed toy train to Ghum via the Batasia Loop.', estimatedCost: 1500, durationMinutes: 150, popularity: 90 },
      { name: 'Happy Valley tea estate', type: 'NATURE', description: 'Planted 1854; the factory runs during first and second flush.', estimatedCost: 300, durationMinutes: 120, popularity: 82 },
      { name: 'Padmaja Naidu Himalayan Zoological Park', type: 'NATURE', description: 'Snow leopard and red panda breeding centre, shared with the mountaineering institute.', estimatedCost: 100, durationMinutes: 150, popularity: 78 },
    ],
  },
  {
    name: 'Gangtok',
    state: 'Sikkim',
    region: 'Himalayas',
    latitude: 27.3389,
    longitude: 88.6065,
    costIndex: 42,
    popularity: 79,
    description:
      'Sikkim\'s hill capital at 1,650m — Buddhist monasteries, a pedestrianised main street, and permits onward to the high lakes.',
    activities: [
      { name: 'Tsomgo Lake and Baba Mandir', type: 'NATURE', description: 'A glacial lake at 3,753m, frozen in winter; permit and registered vehicle required.', estimatedCost: 3000, durationMinutes: 420, popularity: 90 },
      { name: 'Rumtek Monastery', type: 'CULTURE', description: 'The seat of the Karmapa in exile, 24km out, with a golden stupa inside.', estimatedCost: 100, durationMinutes: 210, popularity: 84 },
      { name: 'MG Marg evening', type: 'SIGHTSEEING', description: 'A traffic-free, litter-free boulevard where the whole town walks after dark.', estimatedCost: 0, durationMinutes: 90, popularity: 80 },
      { name: 'Nathula Pass', type: 'ADVENTURE', description: 'The 4,310m Indo-China trade pass; Indian nationals only, permit required.', estimatedCost: 4000, durationMinutes: 480, popularity: 82 },
    ],
  },
  {
    name: 'Shillong',
    state: 'Meghalaya',
    region: 'Northeast India',
    latitude: 25.5788,
    longitude: 91.8933,
    costIndex: 40,
    popularity: 76,
    description:
      'The Scotland of the East — a Khasi hill capital with waterfalls in every direction and a serious live-music habit.',
    activities: [
      { name: 'Living root bridges, Nongriat', type: 'ADVENTURE', description: 'Ficus roots trained across streams over decades; 3,000 steps down to the double-decker.', estimatedCost: 500, durationMinutes: 480, popularity: 94 },
      { name: 'Mawlynnong, Asia\'s cleanest village', type: 'SIGHTSEEING', description: 'Bamboo dustbins on every lane and a sky-walk over the Bangladesh plains.', estimatedCost: 1200, durationMinutes: 360, popularity: 84 },
      { name: 'Elephant Falls and Shillong Peak', type: 'NATURE', description: 'A three-tier fall on the edge of town, then the highest point at 1,965m.', estimatedCost: 200, durationMinutes: 180, popularity: 78 },
      { name: 'Dawki river boating', type: 'NATURE', description: 'The Umngot runs so clear the boats appear to float on air in the dry season.', estimatedCost: 1000, durationMinutes: 300, popularity: 88 },
    ],
  },
  {
    name: 'Kaziranga',
    state: 'Assam',
    region: 'Northeast India',
    latitude: 26.5775,
    longitude: 93.1711,
    costIndex: 36,
    popularity: 78,
    description:
      'Floodplain grassland on the Brahmaputra holding roughly two-thirds of the world\'s one-horned rhinoceros.',
    activities: [
      { name: 'Elephant-back safari, Western range', type: 'NATURE', description: 'The dawn ride gets closest to rhino in the tall elephant grass.', estimatedCost: 2500, durationMinutes: 120, popularity: 92 },
      { name: 'Jeep safari, Central (Kohora) range', type: 'NATURE', description: 'Rhino, wild buffalo, swamp deer, and a fair chance of tiger.', estimatedCost: 3500, durationMinutes: 210, popularity: 90 },
      { name: 'Brahmaputra sunset cruise', type: 'SIGHTSEEING', description: 'River dolphins surface on the calmer stretches in the late afternoon.', estimatedCost: 1200, durationMinutes: 150, popularity: 76 },
      { name: 'Assam tea garden visit', type: 'NATURE', description: 'Estates surround the park; the CTC processing floor is worth the stop.', estimatedCost: 400, durationMinutes: 120, popularity: 72 },
    ],
  },
  {
    name: 'Puri',
    state: 'Odisha',
    region: 'East India',
    latitude: 19.8135,
    longitude: 85.8312,
    costIndex: 30,
    popularity: 76,
    description:
      'One of the four Char Dham pilgrimage sites, on a long Bay of Bengal beach, and host to the Rath Yatra chariot festival.',
    activities: [
      { name: 'Jagannath Temple', type: 'CULTURE', description: 'A 12th-century temple whose kitchen may be the largest in the world. Hindus only inside.', estimatedCost: 0, durationMinutes: 120, popularity: 92 },
      { name: 'Konark Sun Temple', type: 'CULTURE', description: 'A 13th-century temple built as Surya\'s chariot, with 24 carved stone wheels. 35km away.', estimatedCost: 600, durationMinutes: 240, popularity: 94 },
      { name: 'Puri beach at sunrise', type: 'RELAXATION', description: 'Fishing boats launching at first light, with sand artists further along.', estimatedCost: 0, durationMinutes: 90, popularity: 80 },
      { name: 'Raghurajpur artists\' village', type: 'CULTURE', description: 'Every house makes pattachitra scroll paintings or palm-leaf engravings.', estimatedCost: 300, durationMinutes: 180, popularity: 74 },
    ],
  },

  // =========================================================================
  // Central India
  // =========================================================================
  {
    name: 'Khajuraho',
    state: 'Madhya Pradesh',
    region: 'Central India',
    latitude: 24.8318,
    longitude: 79.9199,
    costIndex: 30,
    popularity: 80,
    description:
      'Twenty-five surviving Chandela temples of the 10th–11th centuries, covered in some of the finest figurative sculpture in India.',
    activities: [
      { name: 'Western Group of Temples', type: 'CULTURE', description: 'Kandariya Mahadeva and Lakshmana — the densest and best-preserved carving.', estimatedCost: 600, durationMinutes: 180, popularity: 94 },
      { name: 'Eastern and Southern groups by cycle', type: 'CULTURE', description: 'Jain temples among the fields, almost empty compared with the western group.', estimatedCost: 300, durationMinutes: 180, popularity: 78 },
      { name: 'Light and sound show', type: 'CULTURE', description: 'The Chandela story told across the western group after dark.', estimatedCost: 400, durationMinutes: 60, popularity: 72 },
      { name: 'Panna National Park safari', type: 'NATURE', description: 'A tiger reserve on the Ken, 25km away, successfully repopulated after 2009.', estimatedCost: 3500, durationMinutes: 300, popularity: 76 },
    ],
  },
  {
    name: 'Orchha',
    state: 'Madhya Pradesh',
    region: 'Central India',
    latitude: 25.3518,
    longitude: 78.6407,
    costIndex: 26,
    popularity: 70,
    description:
      'A Bundela capital frozen since the 17th century, with palaces and cenotaphs along the Betwa.',
    activities: [
      { name: 'Jahangir Mahal and Raj Mahal', type: 'CULTURE', description: 'A palace built for a single overnight imperial visit in 1606.', estimatedCost: 250, durationMinutes: 150, popularity: 84 },
      { name: 'Chhatris on the Betwa at sunset', type: 'SIGHTSEEING', description: 'Fourteen royal cenotaphs along the river, with vultures nesting on top.', estimatedCost: 0, durationMinutes: 90, popularity: 82 },
      { name: 'Ram Raja Temple', type: 'CULTURE', description: 'The only place where Rama is worshipped as a king — a palace that became a temple.', estimatedCost: 0, durationMinutes: 60, popularity: 76 },
      { name: 'Betwa river rafting', type: 'ADVENTURE', description: 'A gentle Grade II float past the cenotaphs.', estimatedCost: 800, durationMinutes: 120, popularity: 68 },
    ],
  },
  {
    name: 'Bhopal (Sanchi)',
    state: 'Madhya Pradesh',
    region: 'Central India',
    latitude: 23.2599,
    longitude: 77.4126,
    costIndex: 34,
    popularity: 68,
    description:
      'A lake city of Begum-era mosques, and the base for Sanchi\'s Buddhist stupas and the Bhimbetka rock shelters.',
    activities: [
      { name: 'Sanchi Stupa', type: 'CULTURE', description: 'Commissioned by Ashoka in the 3rd century BC; the carved gateways came later.', estimatedCost: 600, durationMinutes: 210, popularity: 88 },
      { name: 'Bhimbetka rock shelters', type: 'CULTURE', description: 'Rock paintings spanning perhaps 10,000 years, in natural sandstone caves.', estimatedCost: 600, durationMinutes: 240, popularity: 82 },
      { name: 'Taj-ul-Masajid', type: 'CULTURE', description: 'One of the largest mosques in Asia, begun by Shah Jahan Begum in the 1870s.', estimatedCost: 0, durationMinutes: 90, popularity: 72 },
      { name: 'Upper Lake (Bhojtal) boating', type: 'NATURE', description: 'An 11th-century man-made lake, still the city\'s water supply.', estimatedCost: 300, durationMinutes: 90, popularity: 66 },
    ],
  },
  {
    name: 'Ranthambore (Sawai Madhopur)',
    state: 'Rajasthan',
    region: 'North India',
    latitude: 26.0173,
    longitude: 76.5026,
    costIndex: 44,
    popularity: 82,
    description:
      'Dry deciduous forest around a 10th-century hill fort — among the most reliable places in India to see a wild tiger.',
    activities: [
      { name: 'Tiger safari, zones 1–5', type: 'NATURE', description: 'The core zones around the lakes hold the highest density; book months ahead.', estimatedCost: 5500, durationMinutes: 240, popularity: 95 },
      { name: 'Ranthambore Fort', type: 'CULTURE', description: 'A UNESCO-listed fort inside the reserve, free to enter and often empty.', estimatedCost: 0, durationMinutes: 180, popularity: 78 },
      { name: 'Canter safari', type: 'NATURE', description: 'The 20-seat option — cheaper than a jeep and easier to get at short notice.', estimatedCost: 2000, durationMinutes: 240, popularity: 80 },
      { name: 'Dastkar craft centre', type: 'SHOPPING', description: 'A women\'s cooperative set up for families displaced by the reserve.', estimatedCost: 200, durationMinutes: 90, popularity: 64 },
    ],
  },

  // =========================================================================
  // Islands
  // =========================================================================
  {
    name: 'Port Blair',
    state: 'Andaman and Nicobar Islands',
    region: 'Islands',
    latitude: 11.6234,
    longitude: 92.7265,
    costIndex: 56,
    popularity: 80,
    description:
      'The Andaman capital, and the arrival point for the islands — with the colonial prison that gives the place its weight.',
    activities: [
      { name: 'Cellular Jail and light-and-sound', type: 'CULTURE', description: 'The kala pani prison of 1906; the evening show is told from a surviving wing.', estimatedCost: 300, durationMinutes: 180, popularity: 90 },
      { name: 'Ross Island (Netaji Subhas Dweep)', type: 'SIGHTSEEING', description: 'The old British administrative seat, now roots-through-ruins and deer.', estimatedCost: 600, durationMinutes: 180, popularity: 82 },
      { name: 'North Bay snorkelling', type: 'ADVENTURE', description: 'Fringing reef 30 minutes out; also glass-bottom boats for non-swimmers.', estimatedCost: 1800, durationMinutes: 240, popularity: 84 },
      { name: 'Chidiya Tapu sunset', type: 'NATURE', description: 'A birding point at the southern tip, with a mangrove trail behind the beach.', estimatedCost: 400, durationMinutes: 150, popularity: 74 },
    ],
  },
  {
    name: 'Havelock (Swaraj Dweep)',
    state: 'Andaman and Nicobar Islands',
    region: 'Islands',
    latitude: 11.9754,
    longitude: 92.9863,
    costIndex: 58,
    popularity: 86,
    description:
      'The Andamans\' best-known island, with Radhanagar — regularly rated among Asia\'s finest beaches.',
    activities: [
      { name: 'Radhanagar Beach (Beach No. 7)', type: 'RELAXATION', description: 'A wide white crescent backed by rainforest; the sunset here is the island\'s ritual.', estimatedCost: 0, durationMinutes: 240, popularity: 95 },
      { name: 'Scuba diving at Nemo Reef', type: 'ADVENTURE', description: 'Warm, clear water and easy reefs make this a good place to do a first dive.', estimatedCost: 4500, durationMinutes: 240, popularity: 90 },
      { name: 'Elephant Beach snorkelling', type: 'ADVENTURE', description: 'Reached by boat or a muddy 40-minute forest walk; coral starts a few metres out.', estimatedCost: 2000, durationMinutes: 300, popularity: 86 },
      { name: 'Kalapathar Beach at sunrise', type: 'SIGHTSEEING', description: 'Black rocks against turquoise on the eastern shore, quiet at dawn.', estimatedCost: 0, durationMinutes: 120, popularity: 80 },
    ],
  },

  // =========================================================================
  // Additional destinations — filling out the east, northeast and the coast
  // =========================================================================
  {
    name: 'Dharamshala (McLeod Ganj)',
    state: 'Himachal Pradesh',
    region: 'Himalayas',
    latitude: 32.219,
    longitude: 76.3234,
    costIndex: 36,
    popularity: 82,
    description:
      'Seat of the Tibetan government-in-exile and home of the Dalai Lama, on a Dhauladhar ridge above the Kangra valley.',
    activities: [
      { name: 'Tsuglagkhang Complex', type: 'CULTURE', description: 'The Dalai Lama\'s temple, with the Tibet Museum documenting the exile.', estimatedCost: 0, durationMinutes: 120, popularity: 90 },
      { name: 'Triund trek', type: 'ADVENTURE', description: 'A 9km climb to a 2,850m ridge camp directly under the Dhauladhar wall.', estimatedCost: 1200, durationMinutes: 480, popularity: 92 },
      { name: 'Bhagsunag waterfall and café', type: 'NATURE', description: 'A short walk from McLeod to a fall, temple and the well-known Shiva Café.', estimatedCost: 100, durationMinutes: 150, popularity: 80 },
      { name: 'Norbulingka Institute', type: 'CULTURE', description: 'Thangka painting, wood carving and metalwork kept alive in a Japanese-style garden.', estimatedCost: 100, durationMinutes: 150, popularity: 74 },
    ],
  },
  {
    name: 'Spiti Valley (Kaza)',
    state: 'Himachal Pradesh',
    region: 'Himalayas',
    latitude: 32.2264,
    longitude: 78.0716,
    costIndex: 40,
    popularity: 78,
    description:
      'A cold desert valley at 3,800m between the Himalaya and Zanskar ranges, cut off by snow for much of the year.',
    activities: [
      { name: 'Key Monastery', type: 'CULTURE', description: 'A thousand-year-old fort-monastery stacked up a conical hill above the Spiti river.', estimatedCost: 100, durationMinutes: 150, popularity: 92 },
      { name: 'Chandratal Lake', type: 'NATURE', description: 'A crescent moon lake at 4,300m, reachable roughly June to October.', estimatedCost: 3000, durationMinutes: 480, popularity: 90 },
      { name: 'Hikkim — the world\'s highest post office', type: 'SIGHTSEEING', description: 'Post a card home from 4,400m; also Komic and Langza on the same loop.', estimatedCost: 1500, durationMinutes: 300, popularity: 84 },
      { name: 'Pin Valley National Park', type: 'NATURE', description: 'Snow leopard country, and the ibex they hunt, in a side valley south of Kaza.', estimatedCost: 2000, durationMinutes: 360, popularity: 76 },
    ],
  },
  {
    name: 'Mussoorie',
    state: 'Uttarakhand',
    region: 'Himalayas',
    latitude: 30.4598,
    longitude: 78.0664,
    costIndex: 42,
    popularity: 74,
    description:
      'The Queen of the Hills at 2,000m, looking north to the Garhwal peaks and south over the Doon valley.',
    activities: [
      { name: 'Gun Hill ropeway', type: 'SIGHTSEEING', description: 'The second-highest point in town, with Bandarpunch on the skyline.', estimatedCost: 150, durationMinutes: 90, popularity: 78 },
      { name: 'Kempty Falls', type: 'NATURE', description: 'A five-tier fall 15km out; go early, it fills up by mid-morning.', estimatedCost: 100, durationMinutes: 150, popularity: 74 },
      { name: 'Camel\'s Back Road walk', type: 'NATURE', description: 'A 3km level promenade with a rock formation that gives it the name.', estimatedCost: 0, durationMinutes: 90, popularity: 72 },
      { name: 'Landour and Char Dukan', type: 'FOOD', description: 'A quiet cantonment above the mall, with colonial cottages and four tea shops.', estimatedCost: 300, durationMinutes: 120, popularity: 76 },
    ],
  },
  {
    name: 'Haridwar',
    state: 'Uttarakhand',
    region: 'North India',
    latitude: 29.9457,
    longitude: 78.1642,
    costIndex: 28,
    popularity: 80,
    description:
      'Where the Ganges leaves the mountains for the plains — one of the four Kumbh Mela cities.',
    activities: [
      { name: 'Har Ki Pauri evening aarti', type: 'CULTURE', description: 'Hundreds of lamps set on the water at the ghat said to bear Vishnu\'s footprint.', estimatedCost: 0, durationMinutes: 90, popularity: 92 },
      { name: 'Mansa Devi ropeway', type: 'CULTURE', description: 'Cable car up Bilwa Parvat to a hilltop Shakti temple over the town.', estimatedCost: 250, durationMinutes: 120, popularity: 80 },
      { name: 'Chandi Devi Temple', type: 'CULTURE', description: 'On the Neel Parvat across the river, reached by ropeway or a 3km climb.', estimatedCost: 250, durationMinutes: 150, popularity: 74 },
      { name: 'Rajaji National Park safari', type: 'NATURE', description: 'Elephant, leopard and over 300 bird species on the edge of town.', estimatedCost: 2500, durationMinutes: 210, popularity: 72 },
    ],
  },
  {
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    region: 'North India',
    latitude: 26.8467,
    longitude: 80.9462,
    costIndex: 38,
    popularity: 74,
    description:
      'The Nawabi capital — Awadhi cooking, chikankari embroidery, and a courtly politeness the city is still known for.',
    activities: [
      { name: 'Bara Imambara and the Bhulbhulaiya', type: 'CULTURE', description: 'A 50m vaulted hall built without beams, over a genuine labyrinth. Take a guide.', estimatedCost: 500, durationMinutes: 180, popularity: 90 },
      { name: 'Chota Imambara', type: 'CULTURE', description: 'Chandeliers, gilt domes and Belgian glass — the Palace of Lights.', estimatedCost: 300, durationMinutes: 90, popularity: 80 },
      { name: 'Awadhi food trail in Chowk', type: 'FOOD', description: 'Tunday kebab, kakori, sheermal and warqi paratha within a few lanes.', estimatedCost: 500, durationMinutes: 150, popularity: 92 },
      { name: 'Chikankari shopping in Aminabad', type: 'SHOPPING', description: 'Hand-embroidered white-on-white cotton, a Lucknow craft for 400 years.', estimatedCost: 800, durationMinutes: 120, popularity: 78 },
      { name: 'British Residency ruins', type: 'CULTURE', description: 'Shell-scarred walls left as they stood after the 1857 siege.', estimatedCost: 300, durationMinutes: 120, popularity: 72 },
    ],
  },
  {
    name: 'Bodh Gaya',
    state: 'Bihar',
    region: 'East India',
    latitude: 24.6961,
    longitude: 84.9869,
    costIndex: 26,
    popularity: 76,
    description:
      'Where the Buddha attained enlightenment under the Bodhi tree — the most significant of the four main Buddhist sites.',
    activities: [
      { name: 'Mahabodhi Temple and the Bodhi tree', type: 'CULTURE', description: 'A UNESCO site around a descendant of the original tree; monks meditate day and night.', estimatedCost: 0, durationMinutes: 180, popularity: 95 },
      { name: 'Great Buddha Statue', type: 'CULTURE', description: 'A 25m sandstone and red granite Buddha, consecrated by the Dalai Lama in 1989.', estimatedCost: 50, durationMinutes: 60, popularity: 82 },
      { name: 'International monastery circuit', type: 'CULTURE', description: 'Thai, Bhutanese, Japanese and Tibetan monasteries, each in its national style.', estimatedCost: 0, durationMinutes: 180, popularity: 78 },
      { name: 'Sujata Stupa and village', type: 'CULTURE', description: 'Across the Falgu, where the Buddha accepted the milk-rice that ended his fasting.', estimatedCost: 100, durationMinutes: 120, popularity: 70 },
    ],
  },
  {
    name: 'Guwahati',
    state: 'Assam',
    region: 'Northeast India',
    latitude: 26.1445,
    longitude: 91.7362,
    costIndex: 38,
    popularity: 70,
    description:
      'The gateway to the Northeast, on the Brahmaputra, with the Kamakhya temple on a hill above the river.',
    activities: [
      { name: 'Kamakhya Temple', type: 'CULTURE', description: 'One of the most important Shakti Peethas, on Nilachal Hill.', estimatedCost: 0, durationMinutes: 150, popularity: 88 },
      { name: 'Brahmaputra river cruise', type: 'SIGHTSEEING', description: 'Sunset on one of the few rivers in India treated as male.', estimatedCost: 800, durationMinutes: 120, popularity: 78 },
      { name: 'Umananda Island', type: 'CULTURE', description: 'The smallest inhabited river island in the world, with a Shiva temple and golden langurs.', estimatedCost: 300, durationMinutes: 150, popularity: 74 },
      { name: 'Assam State Museum', type: 'CULTURE', description: 'Sculpture, textiles and a reconstructed Assamese village house.', estimatedCost: 100, durationMinutes: 120, popularity: 64 },
    ],
  },
  {
    name: 'Mahabalipuram',
    state: 'Tamil Nadu',
    region: 'South India',
    latitude: 12.6269,
    longitude: 80.1928,
    costIndex: 34,
    popularity: 82,
    description:
      'A 7th-century Pallava port on the Coromandel coast, carved directly out of the granite outcrops.',
    activities: [
      { name: 'Shore Temple', type: 'CULTURE', description: 'One of the oldest stone temples in South India, standing right on the surf line.', estimatedCost: 600, durationMinutes: 90, popularity: 92 },
      { name: 'Arjuna\'s Penance bas-relief', type: 'CULTURE', description: 'A 27m by 9m rock face carved with the descent of the Ganges. Free to view.', estimatedCost: 0, durationMinutes: 75, popularity: 88 },
      { name: 'Pancha Rathas', type: 'CULTURE', description: 'Five monolithic temples, each cut from a single rock in a different style.', estimatedCost: 600, durationMinutes: 90, popularity: 86 },
      { name: 'Stone carving workshops', type: 'CULTURE', description: 'The craft never stopped here — sculptors still work granite along the main road.', estimatedCost: 200, durationMinutes: 90, popularity: 70 },
    ],
  },
  {
    name: 'Varkala',
    state: 'Kerala',
    region: 'South India',
    latitude: 8.7379,
    longitude: 76.7163,
    costIndex: 36,
    popularity: 80,
    description:
      'A red laterite cliff running straight down to the Arabian Sea, with a mineral spring beach at the foot of it.',
    activities: [
      { name: 'North Cliff walk at sunset', type: 'SIGHTSEEING', description: 'A path along the cliff edge lined with cafés looking due west.', estimatedCost: 0, durationMinutes: 90, popularity: 90 },
      { name: 'Papanasam Beach', type: 'RELAXATION', description: 'The spring water here is held to wash away sins; also where ashes are scattered.', estimatedCost: 0, durationMinutes: 180, popularity: 84 },
      { name: 'Janardanaswamy Temple', type: 'CULTURE', description: 'A 2,000-year-old Vishnu temple just back from the cliff.', estimatedCost: 0, durationMinutes: 60, popularity: 72 },
      { name: 'Ayurvedic massage', type: 'RELAXATION', description: 'Abhyanga or shirodhara at a clifftop centre — Kerala\'s other main export.', estimatedCost: 1500, durationMinutes: 90, popularity: 80 },
    ],
  },
  {
    name: 'Wayanad',
    state: 'Kerala',
    region: 'South India',
    latitude: 11.6854,
    longitude: 76.132,
    costIndex: 38,
    popularity: 76,
    description:
      'Highland Kerala — spice and coffee plantations, prehistoric caves, and a wildlife sanctuary on the Karnataka border.',
    activities: [
      { name: 'Edakkal Caves', type: 'CULTURE', description: 'Neolithic petroglyphs up a steep climb, some perhaps 8,000 years old.', estimatedCost: 400, durationMinutes: 180, popularity: 86 },
      { name: 'Chembra Peak heart lake trek', type: 'ADVENTURE', description: 'A climb to a heart-shaped tarn that has never been known to dry up.', estimatedCost: 1500, durationMinutes: 300, popularity: 84 },
      { name: 'Wayanad Wildlife Sanctuary safari', type: 'NATURE', description: 'Part of the Nilgiri Biosphere — elephant, gaur and the occasional tiger.', estimatedCost: 1800, durationMinutes: 180, popularity: 80 },
      { name: 'Banasura Sagar Dam', type: 'NATURE', description: 'India\'s largest earth dam, with islands formed as the reservoir filled.', estimatedCost: 300, durationMinutes: 150, popularity: 74 },
    ],
  },
  {
    name: 'Bikaner',
    state: 'Rajasthan',
    region: 'North India',
    latitude: 28.0229,
    longitude: 73.3119,
    costIndex: 30,
    popularity: 68,
    description:
      'A Thar desert city known for Junagarh Fort, a camel research farm, and the temple where rats are revered.',
    activities: [
      { name: 'Junagarh Fort', type: 'CULTURE', description: 'One of the few major Rajasthan forts not built on a hill, and never taken.', estimatedCost: 400, durationMinutes: 150, popularity: 84 },
      { name: 'Karni Mata Temple (Deshnoke)', type: 'CULTURE', description: 'The rat temple, 30km south; some 25,000 rats are cared for as sacred.', estimatedCost: 100, durationMinutes: 180, popularity: 78 },
      { name: 'National Research Centre on Camel', type: 'NATURE', description: 'A working government camel farm — and camel-milk ice cream at the gate.', estimatedCost: 100, durationMinutes: 120, popularity: 68 },
      { name: 'Bikaneri bhujia and rasgulla', type: 'FOOD', description: 'The snack that carries the city\'s name, from the shops that invented it.', estimatedCost: 200, durationMinutes: 60, popularity: 72 },
    ],
  },
  {
    name: 'Tirupati',
    state: 'Andhra Pradesh',
    region: 'South India',
    latitude: 13.6288,
    longitude: 79.4192,
    costIndex: 30,
    popularity: 78,
    description:
      'The hill temple of Venkateswara at Tirumala — by most counts the most visited religious site on earth.',
    activities: [
      { name: 'Tirumala Venkateswara Temple', type: 'CULTURE', description: 'Book darshan online well ahead; the free queue can run many hours.', estimatedCost: 300, durationMinutes: 360, popularity: 96 },
      { name: 'Sri Venkateswara National Park', type: 'NATURE', description: 'Talakona waterfall and forest trails in the Seshachalam hills.', estimatedCost: 200, durationMinutes: 240, popularity: 68 },
      { name: 'Chandragiri Fort', type: 'CULTURE', description: 'An 11th-century Vijayanagara fort with a palace-turned-museum, 15km west.', estimatedCost: 200, durationMinutes: 150, popularity: 66 },
    ],
  },
];

export const INDIA_CITY_COUNT = indiaCities.length;
export const INDIA_ACTIVITY_COUNT = indiaCities.reduce((n, c) => n + c.activities.length, 0);
