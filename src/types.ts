// סוגי נתונים משותפים לכל האפליקציה

export interface Product {
  title: string;
  price: string;
  store: string;
  image: string;
  link: string;
}

export interface SavedItem extends Product {
  savedAt: number;
}

// בדיקת מגבלת סריקות (5 ליום)
export function checkScanLimit(): boolean {
  const today = new Date().toDateString();
  const raw = localStorage.getItem('snapstyle_scan_count');
  const data = raw ? JSON.parse(raw) : { date: '', count: 0 };
  if (data.date !== today) return true;
  return data.count < 5;
}

// הוספת סריקה למונה
export function incrementScanCount(): void {
  const today = new Date().toDateString();
  const raw = localStorage.getItem('snapstyle_scan_count');
  const data = raw ? JSON.parse(raw) : { date: '', count: 0 };
  localStorage.setItem(
    'snapstyle_scan_count',
    JSON.stringify({ date: today, count: data.date === today ? data.count + 1 : 1 })
  );
}

// שמירה לארון
export function saveToWardrobe(item: Product): void {
  const raw = localStorage.getItem('snapstyle_wardrobe');
  const wardrobe: SavedItem[] = raw ? JSON.parse(raw) : [];
  if (!wardrobe.find(s => s.link === item.link)) {
    wardrobe.unshift({ ...item, savedAt: Date.now() });
    localStorage.setItem('snapstyle_wardrobe', JSON.stringify(wardrobe));
  }
}

// מוצרי דמו לכשה-API לא זמין
export const DEMO_PRODUCTS: Product[] = [
  { title: "ג'קט עור שחור קלאסי", price: "₪299", store: "ZARA", image: "", link: "#1" },
  { title: "Biker Jacket PU", price: "₪189", store: "H&M", image: "", link: "#2" },
  { title: "מעיל עור אורבני", price: "₪459", store: "ASOS", image: "", link: "#3" },
  { title: "Leather Jacket Premium", price: "₪890", store: "Mango", image: "", link: "#4" },
  { title: "ג'קט וינטאג'", price: "₪145", store: "Pull&Bear", image: "", link: "#5" },
  { title: "Urban Moto Jacket", price: "₪320", store: "Terminator", image: "", link: "#6" },
];
