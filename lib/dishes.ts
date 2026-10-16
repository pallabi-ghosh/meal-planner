// A small built-in list of family dinners per cuisine. It backs up the AI model: when the
// model is off or gives too little, suggestions and alternatives still work. The calorie
// figures are rough, per adult serving, and shown as estimates.

export interface DinnerIdea {
  dish: string;
  cuisine: string;
  ingredients: string[];
  kcal?: number;
}

function idea(cuisine: string, dish: string, kcal: number, ingredients: string): DinnerIdea {
  return { cuisine, dish, kcal, ingredients: ingredients.split(",").map((i) => i.trim()) };
}

const BANK: DinnerIdea[] = [
  idea("Bengali", "Dal, rice and greens", 520, "masoor dal, rice, spinach, onion, garlic, turmeric, mustard oil"),
  idea("Bengali", "Fish curry with rice", 590, "fish, rice, tomato, onion, ginger, turmeric, green chilli, mustard oil"),
  idea("Bengali", "Chicken curry with roti", 640, "chicken, wholemeal flour, onion, tomato, ginger, garlic, green chilli, yoghurt"),
  idea("Bengali", "Egg curry with roti", 520, "eggs, wholemeal flour, onion, tomato, turmeric, ginger"),
  idea("Bengali", "Aloo posto with rice", 500, "potato, poppy seeds, rice, onion, green chilli, mustard oil"),
  idea("Bengali", "Khichuri with vegetables", 480, "rice, moong dal, mixed vegetables, ginger, turmeric, ghee"),
  idea("Indian", "Palak paneer with roti", 560, "spinach, paneer, onion, tomato, garlic, ginger, wholemeal flour"),
  idea("Indian", "Chana masala with rice", 540, "chickpeas, tomato, onion, garlic, ginger, rice, garam masala, green chilli"),
  idea("Indian", "Butter chicken with rice", 680, "chicken, tomato passata, cream, butter, onion, garlic, rice"),
  idea("Indian", "Vegetable biryani", 560, "basmati rice, mixed vegetables, onion, yoghurt, biryani spices, ghee"),
  idea("Indian", "Dal tadka with roti", 500, "toor dal, onion, tomato, garlic, cumin, wholemeal flour, ghee"),
  idea("Indian", "Tandoori chicken with salad", 520, "chicken, yoghurt, tandoori spices, cucumber, tomato, lettuce"),
  idea("Italian", "Pasta bake with vegetables", 600, "pasta, tomato passata, courgette, pepper, mozzarella, onion"),
  idea("Italian", "Meatball pasta", 700, "pasta, minced beef, tomato passata, onion, garlic, parmesan"),
  idea("Italian", "Vegetable lasagne", 620, "lasagne sheets, tomato passata, aubergine, courgette, mozzarella, milk, flour"),
  idea("Italian", "Mushroom risotto", 560, "arborio rice, mushrooms, onion, parmesan, butter"),
  idea("Italian", "Margherita pizza with salad", 650, "pizza dough, tomato passata, mozzarella, basil, salad leaves"),
  idea("Italian", "Minestrone with bread", 420, "carrots, celery, onion, beans, tomato, small pasta, bread"),
  idea("Danish", "Frikadeller with potatoes and red cabbage", 700, "minced pork, onion, egg, flour, milk, potatoes, red cabbage"),
  idea("Danish", "Salmon with potatoes and dill", 600, "salmon, potatoes, dill, lemon, butter, cucumber"),
  idea("Danish", "Chicken with root vegetables", 560, "chicken thighs, carrots, parsnip, potatoes, thyme"),
  idea("Danish", "Fish cakes with remoulade and rye bread", 580, "white fish, onion, egg, flour, milk, rye bread, remoulade"),
  idea("Danish", "Vegetable soup with rye bread", 400, "carrots, leek, potatoes, celeriac, rye bread"),
  idea("Danish", "Pasta with meat sauce", 670, "pasta, minced beef, tomato passata, onion, carrots"),
  idea("Mexican", "Chicken fajitas", 620, "chicken, peppers, onion, tortillas, sour cream, lime"),
  idea("Mexican", "Bean and cheese quesadillas", 580, "tortillas, black beans, cheese, sweetcorn, tomato"),
  idea("Mexican", "Veggie burrito bowl", 600, "rice, black beans, sweetcorn, avocado, tomato, lime"),
  idea("Mexican", "Beef tacos", 650, "minced beef, taco shells, lettuce, tomato, cheese, sour cream"),
  idea("Mexican", "Sweet potato and black bean chilli", 520, "sweet potato, black beans, tomato, onion, chilli powder, rice"),
  idea("Mexican", "Chicken enchiladas", 680, "chicken, tortillas, tomato passata, cheese, onion, black beans"),
  idea("Thai", "Green chicken curry with rice", 680, "chicken, green curry paste, coconut milk, aubergine, rice, red chilli"),
  idea("Thai", "Pad thai", 640, "rice noodles, egg, tofu, beansprouts, peanuts, lime, soy sauce"),
  idea("Thai", "Stir-fried vegetables with tofu and rice", 520, "tofu, broccoli, carrot, pepper, soy sauce, rice"),
  idea("Thai", "Coconut lentil soup", 480, "red lentils, coconut milk, carrot, onion, ginger, lime"),
  idea("Thai", "Chicken satay with rice", 650, "chicken, peanut butter, coconut milk, rice, cucumber"),
  idea("Thai", "Basil chicken stir-fry", 580, "chicken, basil, garlic, red chilli, soy sauce, rice"),
  idea("Mediterranean", "Greek chicken with rice and salad", 600, "chicken, lemon, oregano, rice, cucumber, tomato, feta"),
  idea("Mediterranean", "Shakshuka with bread", 480, "eggs, tomato, pepper, onion, cumin, bread"),
  idea("Mediterranean", "Falafel wrap with hummus", 620, "falafel, wraps, hummus, cucumber, tomato, lettuce"),
  idea("Mediterranean", "Baked salmon with couscous", 640, "salmon, couscous, lemon, courgette, tomato"),
  idea("Mediterranean", "Lentil and vegetable stew", 460, "green lentils, carrots, celery, onion, tomato, cumin"),
  idea("Mediterranean", "Chickpea and spinach pasta", 540, "pasta, chickpeas, spinach, garlic, olive oil, parmesan"),
];

export const KNOWN_CUISINES = [...new Set(BANK.map((i) => i.cuisine))];

// Lower case, single spaces, so "Fish  curry" and "fish curry" match.
export function normaliseDish(dish: string): string {
  return dish.toLowerCase().replace(/\s+/g, " ").trim();
}

// "bengali", "Bengali food" and "Italian on Thursday" all find a known cuisine.
export function matchCuisine(text: string): string | undefined {
  const lower = text.toLowerCase();
  return KNOWN_CUISINES.find((c) => lower.includes(c.toLowerCase()));
}

export function bankDishes(cuisine?: string): DinnerIdea[] {
  const known = cuisine ? matchCuisine(cuisine) : undefined;
  return known ? BANK.filter((i) => i.cuisine === known) : BANK;
}

export function bankKcal(dish: string): number | undefined {
  const wanted = normaliseDish(dish);
  return BANK.find((i) => normaliseDish(i.dish) === wanted)?.kcal;
}
