import React, { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import { createClient } from "@supabase/supabase-js";
import logoImage from "./assets/лого.png";

// ====== CONFIG ======
const POLL_MS = 60000;
const LS_FAVORITES_KEY = "bageatteria:favorites";
const HEADER_H = 48;
const CATS_H = 48;
const HEADER_OFFSET = HEADER_H + CATS_H;

// Env
const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://maxhwefufsnanalmlzla.supabase.co";

const SUPABASE_ANON =
    import.meta.env.VITE_SUPABASE_ANON ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1heGh3ZWZ1ZnNuYW5hbG1semxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNjQ3MDYsImV4cCI6MjA3MDg0MDcwNn0.HvSXCQj77iWvtKlfQg-PWWWESsyn8gQeK9aikbCPr0s";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ====== HELPERS ======
const slug = (s) =>
    (s || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-zа-я0-9-]/gi, "");
const money = (n) => `${(n || 0).toLocaleString("ru-RU")} ₽`;

// Транслитерация с русского на латиницу для URL
const transliterate = (text) => {
    const map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
        'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
        'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
        'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };
    
    return text.split('').map(char => map[char] || char).join('')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};

// Конвертация локации в slug для URL
const locationToSlug = (location) => {
    return transliterate(location);
};

// Находим локацию по slug (поиск в массиве локаций)
const slugToLocation = (locationSlug, availableLocations) => {
    if (!locationSlug) return "";
    return availableLocations.find(loc => transliterate(loc) === locationSlug) || "";
};

// Обработка изображений (только Supabase Storage)
const processImageUrl = (url) => {
    if (!url) return "";
    
    console.log('🔍 Processing URL:', url);
    
    // Если это Supabase Storage - возвращаем как есть
    if (url.includes("supabase.co/storage")) {
        console.log('✅ Supabase Storage URL:', url);
        return url;
    }
    
    // Возвращаем оригинальную ссылку (для совместимости)
    console.log('⚠️ Returning original URL:', url);
    return url;
};

// "Название[:±Цена]" → { label, delta }
function parseOptions(raw) {
    return (raw || "")
        .split(/\s*,\s*/)
        .filter(Boolean)
        .map((part) => {
            const m = part.match(/^(.+?)(?::\s*([+-]?\d+(?:[.,]\d+)?))?$/);
            const label = (m?.[1] || part).trim();
            const delta = m?.[2] ? Number(String(m[2]).replace(",", ".")) : 0;
            return { label, delta };
        });
}

// "Депо, Арбат" → ["Депо","Арбат"]
function parseLocations(raw) {
    return String(raw || "")
        .split(/\s*,\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function calcTotal(item, selected, optList) {
    const base = Number(item.price) || 0;
    const extra = optList
        .filter((o) => selected[o.label])
        .reduce((sum, o) => sum + (Number(o.delta) || 0), 0);
    return base + extra;
}

// Нативный корень скролла
const getScrollRoot = () =>
    document.scrollingElement || document.documentElement || document.body;

// Фоллбекный плавный скролл (на всякий)
function smoothScrollTo(y, duration = 420) {
    const root = getScrollRoot();
    const start = root.scrollTop;
    const dist = y - start;
    if (Math.abs(dist) < 1) return;

    const startTime = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        root.scrollTop = start + dist * ease(t);
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}


// ====== BOTTOM SHEET ======
function BottomSheet({ open, onClose, children }) {
    const [visible, setVisible] = useState(false);
    const [touchStart, setTouchStart] = useState(0);
    const [touchCurrent, setTouchCurrent] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (open) {
            setVisible(true);
            // Блокируем скролл body
            document.body.style.overflow = 'hidden';
        } else {
            // Разблокируем скролл body
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 280);
    };

    // Touch обработчики только для header области
    const handleHeaderTouchStart = (e) => {
        const touch = e.touches[0];
        setTouchStart(touch.clientY);
        setTouchCurrent(touch.clientY);
        setIsDragging(true);
    };

    const handleHeaderTouchMove = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setTouchCurrent(touch.clientY);

        // Превентим прокрутку только при свайпе вниз
        const deltaY = touch.clientY - touchStart;
        if (deltaY > 0) {
            e.preventDefault();
        }
    };

    const handleHeaderTouchEnd = () => {
        if (!isDragging) return;

        const deltaY = touchCurrent - touchStart;
        const threshold = 80; // Минимальное расстояние для закрытия

        if (deltaY > threshold) {
            handleClose();
        }

        setIsDragging(false);
        setTouchStart(0);
        setTouchCurrent(0);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50" onClick={handleClose}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
                    visible ? "opacity-100" : "opacity-0"
                }`}
            />

            {/* Bottom Sheet - оставляем 15% сверху для видимости шторки */}
            <div
                className={`absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out overflow-hidden flex flex-col ${
                    visible ? "translate-y-0" : "translate-y-full"
                }`}
                style={{
                    height: '85vh', // Уменьшаем с 95vh до 85vh
                    maxHeight: '85vh',
                    transform: isDragging && visible
                        ? `translateY(${Math.max(0, touchCurrent - touchStart)}px)`
                        : undefined
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header area для свайпа - увеличиваем область */}
                <div
                    className="flex justify-center pt-4 pb-3 flex-shrink-0 cursor-grab active:cursor-grabbing bg-white rounded-t-2xl"
                    onTouchStart={handleHeaderTouchStart}
                    onTouchMove={handleHeaderTouchMove}
                    onTouchEnd={handleHeaderTouchEnd}
                    style={{ touchAction: 'none' }} // Отключаем стандартные жесты браузера
                >
                    <div className="w-16 h-1.5 bg-[#463223]/40 rounded-full transition-colors duration-200 hover:bg-[#463223]/60"></div>
                </div>

                {/* Scrollable content - свайп здесь не закрывает шторку */}
                <div className="flex-1 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function App() {
    // Global styles
    const Global = () => (
        <style>{`
      html, body, #root { height: 100%; max-width: 100%; overflow-x: hidden; }
      * { box-sizing: border-box; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      
      /* Стилизация выпадающего меню select */
      select option {
        padding: 12px 16px !important;
        font-family: 'Montserrat', sans-serif !important;
        font-weight: 600 !important;
        background-color: white !important;
        color: #463223 !important;
        border: none !important;
      }
      
      select option:hover {
        background-color: rgba(70, 50, 35, 0.05) !important;
      }
      
      select option:checked {
        background-color: #463223 !important;
        color: white !important;
      }
      
      /* Дополнительная стилизация для разных браузеров */
      select::-webkit-scrollbar {
        width: 8px;
      }
      
      select::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      
      select::-webkit-scrollbar-thumb {
        background: #463223;
        border-radius: 4px;
      }
      
      select::-webkit-scrollbar-thumb:hover {
        background: rgba(70, 50, 35, 0.8);
      }
    `}</style>
    );

    // Локации (строки) + выбранная из URL
    const [locations, setLocations] = useState([]);
    const [location, setLocation] = useState("");

    const [items, setItems] = useState([]);
    const [activeCat, setActiveCat] = useState("");
    const [view, setView] = useState("menu"); // 'menu' | 'favorites'
    const [modalItem, setModalItem] = useState(null);
    const [selectedOpts, setSelectedOpts] = useState({});
    const [favorites, setFavorites] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) || "[]");
        } catch {
            return [];
        }
    });

    const chipRefs = useRef({});
    const sectionRefs = useRef({});
    const programmaticUntilRef = useRef(0);

    // ====== LOAD FROM SUPABASE ======
    useEffect(() => {
        let stop = false;
        async function load() {
            try {
                const { data, error } = await sb.from("menu").select("*").eq("available", true);
                if (error) throw error;
                const norm = (data || []).map((r) => {
                    const optList = parseOptions(r.options);
                    const locs = parseLocations(r.location);
                    return {
                        ID: r.id,
                        category: r.category,
                        name: r.name,
                        description: r.description || "",
                        ingredients: r.ingredients || "",
                        size: r.size || "",
                        price: Number(r.price) || 0,
                        photo: processImageUrl(r.photo) || "",
                        optionsRaw: r.options || "",
                        optionsList: optList,
                        available: !!r.available,
                        locationRaw: r.location || "",
                        locations: locs,
                        updated_at: r.updated_at,
                    };
                });

                if (!stop) {
                    setItems(norm);
                    const locs = Array.from(
                        new Set(norm.flatMap((d) => d.locations).filter(Boolean))
                    );
                    setLocations(locs);
                    
                    // Получаем локацию из URL и находим соответствующую русскую
                    const urlSlug = new URLSearchParams(window.location.search).get("loc") || "";
                    const locationFromUrl = slugToLocation(urlSlug, locs);
                    
                    if (!location || !locs.includes(location)) {
                        const selectedLocation = locationFromUrl || locs[0] || "";
                        const u = new URL(window.location.href);
                        if (selectedLocation) u.searchParams.set("loc", locationToSlug(selectedLocation));
                        else u.searchParams.delete("loc");
                        history.replaceState({}, "", u.toString());
                        setLocation(selectedLocation);
                    }
                }
            } catch (e) {
                console.error("[Supabase] load failed:", e);
            }
        }
        load();
        const id = setInterval(load, POLL_MS);
        return () => {
            stop = true;
            clearInterval(id);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ====== Derived ======
    const filtered = useMemo(
        () => items.filter((i) => i.available && i.locations.includes(location)),
        [items, location]
    );

    const categories = useMemo(() => {
        const cats = Array.from(new Set(filtered.map((i) => i.category)));
        const desired = [
            "Горячие напитки",
            "Холодные напитки",
            "Каши",
            "Яйца",
            "Круассаны",
            "Сэндвичи",
            "Пицца",
            "Паста",
            "Салаты и закуски",
        ];
        const ordered = desired.filter((d) => cats.includes(d)).concat(cats.filter((c) => !desired.includes(c)));
        if (!activeCat && ordered.length) setActiveCat(ordered[0]);
        return ordered;
    }, [filtered]);

    const byCategory = useMemo(() => {
        const map = {};
        for (const cat of categories) map[cat] = [];
        for (const it of filtered) {
            if (!map[it.category]) map[it.category] = [];
            map[it.category].push(it);
        }
        return map;
    }, [filtered, categories]);

    // Persist favorites
    useEffect(() => {
        localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(favorites));
    }, [favorites]);

    // Active tab while manual scrolling
    useEffect(() => {
        if (view !== "menu") return;
        const observer = new IntersectionObserver(
            (entries) => {
                const now = Date.now();
                if (now < programmaticUntilRef.current) return;
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) {
                    const cat = visible[0].target.getAttribute("data-cat");
                    if (cat && cat !== activeCat) setActiveCat(cat);
                }
            },
            { root: null, rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.5, 1] }
        );
        categories.forEach((cat) => {
            const el = sectionRefs.current[cat];
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [categories, view, activeCat]);

    // Keep active chip in view
    useEffect(() => {
        const chipEl = chipRefs.current[activeCat];
        chipEl?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, [activeCat]);

    // ====== скролл к секции по клику на таб ======
    const scrollToCategory = (cat) => {
        console.log('🔵 scrollToCategory вызвана для:', cat);
        
        setActiveCat(cat);
        
        // Блокируем IntersectionObserver
        programmaticUntilRef.current = Date.now() + 1200;
        
        // Находим элемент секции
        const element = sectionRefs.current[cat];
        console.log('🔵 Найден элемент:', element);
        
        if (element) {
            // Поиск правильного скроллируемого элемента
            const scrollingElement = document.scrollingElement || document.documentElement || document.body;
            
            console.log('🔵 Скроллируемый элемент:', scrollingElement);
            console.log('🔵 scrollTop до:', scrollingElement.scrollTop);
            
            // Простой скролл с использованием правильного элемента
            element.scrollIntoView({ 
                behavior: 'auto', // без анимации пока
                block: 'start' 
            });
            
            // Коррекция на высоту header
            setTimeout(() => {
                const currentScroll = scrollingElement.scrollTop;
                scrollingElement.scrollTop = currentScroll - 100;
                console.log('✅ Скролл завершен, позиция:', scrollingElement.scrollTop);
            }, 10);
            
        } else {
            console.error('❌ Элемент не найден для категории:', cat);
        }
    };

    // Делегатор кликов (для data-scroll-to-cat)
    useEffect(() => {
        const onClick = (e) => {
            const el = e.target.closest("[data-scroll-to-cat]");
            if (!el) return;
            const cat = el.getAttribute("data-scroll-to-cat");
            if (!cat) return;
            e.preventDefault();
            scrollToCategory(cat);
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, [categories]);

    // Favorites helpers
    const toggleFavorite = (item, opts) => {
        const key = `${item.ID}-${JSON.stringify(opts || {})}`;
        const totalPrice = calcTotal(item, opts || {}, item.optionsList);
        setFavorites((prev) => {
            const exists = prev.find((p) => p.key === key);
            if (exists) return prev.filter((p) => p.key !== key);
            return [
                {
                    key,
                    ID: item.ID,
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    totalPrice,
                    size: item.size,
                    photo: item.photo,
                    options: opts || {},
                    optionsList: item.optionsList,
                },
                ...prev,
            ];
        });
    };
    const isFav = (item, opts) =>
        favorites.some((f) => f.key === `${item.ID}-${JSON.stringify(opts || {})}`);

    // Update URL param for location
    const setLocationAndUrl = (loc) => {
        setLocation(loc);
        const u = new URL(window.location.href);
        if (loc) u.searchParams.set("loc", locationToSlug(loc));
        else u.searchParams.delete("loc");
        window.history.pushState({}, "", u.toString());
    };

    // Для динамической цены в модалке
    const modalTotal = modalItem
        ? calcTotal(modalItem, selectedOpts, modalItem.optionsList || [])
        : 0;
    const extraSum =
        modalItem && modalItem.optionsList
            ? modalItem.optionsList
                .filter((o) => selectedOpts[o.label])
                .reduce((s, o) => s + (Number(o.delta) || 0), 0)
            : 0;

    return (
        <div className="min-h-screen bg-[#E3E3E0] text-[#463223] flex flex-col">
            <Global />

            {/* TOP BAR: logo + pretty select */}
            <div className="sticky top-0 z-50 flex h-12 items-center gap-3 border-b border-neutral-200 bg-white px-5">
                <div className="flex items-center">
                    <img 
                        src={logoImage} 
                        alt="Bageatteria" 
                        className="h-8 w-auto object-contain object-center"
                        style={{
                            filter: 'brightness(1.1) contrast(1.2)',
                            maxWidth: '120px'
                        }}
                    />
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-[#463223]/70" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 500}}>
                        Локация:
                    </span>
                    {/* Pretty select */}
                    <div className="relative">
                        <select
                            value={location}
                            onChange={(e) => setLocationAndUrl(e.target.value)}
                            className="w-full appearance-none rounded-lg border-2 border-[#463223]/20 bg-white px-3 py-1.5 pr-8 text-xs text-[#463223] shadow-md transition-all duration-300 hover:border-[#463223]/40 focus:border-[#463223] focus:outline-none focus:ring-2 focus:ring-[#463223]/10"
                            style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}
                        >
                            {locations.map((loc) => (
                                <option 
                                    key={loc} 
                                    value={loc} 
                                    className="py-3 px-4 text-[#463223] bg-white hover:bg-[#463223]/5 checked:bg-[#463223] checked:text-white"
                                    style={{
                                        fontFamily: 'Montserrat, sans-serif', 
                                        fontWeight: 600,
                                        backgroundColor: 'white',
                                        color: '#463223'
                                    }}
                                >
                                    {loc}
                                </option>
                            ))}
                        </select>
                        {/* chevron icon */}
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="transition-transform duration-200"
                            >
                                <path
                                    d="M7 10l5 5 5-5"
                                    stroke="#463223"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* HORIZONTAL CATEGORIES (STICKY) */}
            {view === "menu" && (
                <div className="sticky top-12 z-40 border-b border-neutral-200 bg-white px-1 py-2">
                    <div className="no-scrollbar flex gap-2 overflow-x-auto px-3" style={{ touchAction: "pan-x" }}>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                ref={(el) => (chipRefs.current[cat] = el)}
                                onClick={() => scrollToCategory(cat)}
                                className={`shrink-0 rounded-full border px-3 py-2 text-sm transition-all duration-200 ${
                                    activeCat === cat
                                        ? "border-[#463223] bg-[#463223] text-white shadow-md transform scale-105"
                                        : "border-[#463223]/20 bg-white text-[#463223] hover:border-[#463223]/40 hover:shadow-sm"
                                }`}
                                style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* FAVORITES SUBHEADER with Back */}
            {view === "favorites" && (
                <div className="sticky top-12 z-40 flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
                    <button
                        onClick={() => setView("menu")}
                        className="rounded-lg border-2 border-[#463223]/20 bg-white px-3 py-1 text-sm text-[#463223] transition-all duration-200 hover:border-[#463223]/40 hover:bg-[#463223]/5"
                        style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}
                    >
                        ← Назад
                    </button>
                    <div className="font-semibold text-[#463223]" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 700}}>Избранное</div>
                    <div className="ml-auto text-xs text-[#463223]/60" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 300}}>{favorites.length} поз.</div>
                </div>
            )}

            {/* CONTENT */}
            <div className="flex-1 flex flex-col">
                <div className="mx-auto max-w-screen-md px-3 pb-6 flex-1">
                    {view === "favorites" ? (
                        <FavoritesTextList favorites={favorites} setFavorites={setFavorites} />
                    ) : (
                        categories.map((cat) => (
                            <section
                                key={cat}
                                data-cat={cat}
                                id={`cat-${slug(cat)}`}
                                ref={(el) => (sectionRefs.current[cat] = el)}
                                className="py-3"
                            >
                                <h2
                                    className="mb-2 ml-1 cursor-pointer text-base font-semibold"
                                    onClick={() => scrollToCategory(cat)}
                                    title="Кликни, чтобы проскроллить к началу этой секции"
                                    style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 700}}
                                >
                                    {cat}
                                </h2>
                                <div className="grid grid-cols-2 gap-2">
                                    {(byCategory[cat] || []).map((item) => (
                                        <button
                                            key={item.ID}
                                            onClick={() => {
                                                setModalItem(item);
                                                setSelectedOpts({});
                                            }}
                                            className="group overflow-hidden rounded-xl border border-[#463223]/10 bg-white text-left shadow-lg hover:shadow-xl transition-all duration-200 w-full"
                                        >
                                            <div className="relative">
                                                <img
                                                    src={item.photo}
                                                    alt={item.name}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="h-52 w-full object-cover transition-transform duration-200 group-active:scale-[0.98]"
                                                    onError={(e) => {
                                                        console.log('❌ Image failed to load:', e.target.src);
                                                        // Показываем placeholder
                                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRTNFM0UwIi8+CjxwYXRoIGQ9Ik0xMzAgNzBIMTcwVjEzMEgxMzBWNzBaIiBmaWxsPSIjNDYzMjIzIiBmaWxsLW9wYWNpdHk9IjAuMyIvPgo8cGF0aCBkPSJNMTQ1IDg1TDE1NSA5NUwxNjUgODUiIHN0cm9rZT0iIzQ2MzIyMyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPGNpcmNsZSBjeD0iMTQwIiBjeT0iODUiIHI9IjUiIGZpbGw9IiM0NjMyMjMiLz4KPC9zdmc+';
                                                    }}
                                                />
                                            </div>
                                            <div className="p-4">
                                                <div className="flex-column items-baseline justify-between gap-2">
                                                    <div className="truncate text-sm font-semibold text-[#463223]" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 700}}>{item.name}</div>
                                                    <div className="text-sm font-medium text-[#463223]">{money(item.price)}</div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))
                    )}
                </div>

                {/* FOOTER - всегда внизу */}
                <footer className="mt-auto py-6 text-center text-xs text-[#463223]/60 bg-white border-t border-[#463223]/10">
                    <span style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 300}}>
                        © {new Date().getFullYear()} Bageatteria · Меню по QR · Данные: Supabase
                    </span>
                </footer>
            </div>

            {/* BOTTOM SHEET */}
            <BottomSheet open={!!modalItem} onClose={() => setModalItem(null)}>
                {modalItem && (
                    <div className="h-full flex flex-col">
                        {/* Большая фотография - занимает больше места */}
                        <div className="h-[50vh] min-h-[300px] w-full flex-shrink-0">
                            <img 
                                src={modalItem.photo} 
                                alt={modalItem.name} 
                                decoding="async"
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                    console.log('❌ BottomSheet image failed to load:', e.target.src);
                                    // Показываем placeholder
                                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjRTNFM0UwIi8+CjxwYXRoIGQ9Ik0zNTAgMjAwSDQ1MFYzNTFIMzUwVjIwMFoiIGZpbGw9IiM0NjMyMjMiIGZpbGwtb3BhY2l0eT0iMC4zIi8+CjxwYXRoIGQ9Ik0zNzUgMjI1TDQwMCAyNTBMNDI1IDIyNSIgc3Ryb2tlPSIjNDYzMjIzIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8Y2lyY2xlIGN4PSIzODAiIGN5PSIyMzAiIHI9IjgiIGZpbGw9IiM0NjMyMjMiLz4KPC9zdmc+';
                                }}
                            />
                        </div>
                        
                        {/* Скроллируемый контент */}
                        <div className="flex-1 px-6 py-4 pb-24 space-y-4">
                            {/* Заголовок и цена */}
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="text-xl font-bold text-[#463223] leading-tight" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 700}}>
                                    {modalItem.name}
                                </h3>
                                <div className="text-right flex-shrink-0">
                                    <div className="text-xl font-bold text-[#463223]">
                                        {money(modalTotal)}
                                    </div>
                                    {extraSum > 0 && (
                                        <div className="text-sm text-neutral-500">
                                            (+{money(extraSum)} опции)
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {modalItem.size && (
                                <div className="text-sm text-[#463223]/70 bg-[#463223]/5 px-3 py-2 rounded-lg inline-block" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 500}}>
                                    {modalItem.size}
                                </div>
                            )}
                            
                            {modalItem.description && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-[#463223]" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}>Описание</h4>
                                    <p className="text-sm leading-relaxed text-neutral-700" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 400}}>
                                        {modalItem.description}
                                    </p>
                                </div>
                            )}
                            
                            {modalItem.ingredients && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-[#463223]" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}>Состав</h4>
                                    <p className="text-sm text-neutral-600" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 400}}>
                                        {modalItem.ingredients}
                                    </p>
                                </div>
                            )}

                            {/* Опции в минималистичном стиле */}
                            {!!(modalItem.optionsList && modalItem.optionsList.length) && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-[#463223]" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}>Опции</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {modalItem.optionsList.map((opt) => {
                                            const checked = !!selectedOpts[opt.label];
                                            return (
                                                <button
                                                    key={opt.label}
                                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all duration-200 ${
                                                        checked
                                                            ? "border-[#463223] bg-[#463223] text-white shadow-md transform scale-105"
                                                            : "border-[#463223]/20 bg-white text-[#463223] hover:border-[#463223]/40 hover:shadow-sm hover:scale-105"
                                                    }`}
                                                    onClick={() =>
                                                        setSelectedOpts((p) => ({
                                                            ...p,
                                                            [opt.label]: !p[opt.label],
                                                        }))
                                                    }
                                                    style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}
                                                >
                                                    <span>{opt.label}</span>
                                                    {Number(opt.delta) !== 0 && (
                                                        <span
                                                            className={`text-xs font-semibold ${
                                                                checked ? "text-white/80" : "text-neutral-500"
                                                            }`}
                                                        >
                                                            {opt.delta > 0
                                                                ? `+${money(opt.delta)}`
                                                                : `${money(opt.delta)}`}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Закрепленная кнопка внизу */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
                            <button
                                className="w-full rounded-3xl bg-[#463223] px-6 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:bg-[#463223]/90 hover:shadow-xl active:scale-95"
                                onClick={() => {
                                    toggleFavorite(modalItem, selectedOpts);
                                    setModalItem(null); // Закрываем Bottom Sheet после добавления
                                }}
                                style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 700}}
                            >
                                {isFav(modalItem, selectedOpts) ? "Убрать из избранного" : "Добавить в избранное"}
                            </button>
                        </div>
                    </div>
                )}
            </BottomSheet>

            {/* FLOATING FAVORITES BUTTON */}
            <button
                className="fixed bottom-4 right-4 z-40 inline-flex items-center justify-center rounded-full bg-[#463223] p-4 shadow-2xl transition-all duration-300 hover:shadow-3xl hover:scale-110 active:scale-95 hover:bg-[#463223]/90"
                onClick={() => setView(view === "favorites" ? "menu" : "favorites")}
                aria-label="Избранное"
            >
                {/* heart icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.41 4.41 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.59 3 22 5.41 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="white"/>
                </svg>
                {/* badge */}
                {favorites.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#463223] shadow-md">
                        {favorites.length}
                    </span>
                )}
            </button>

        </div>
    );
}

function FavoritesTextList({ favorites, setFavorites }) {
    const [expandedItem, setExpandedItem] = useState(null);
    
    if (!favorites.length) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 rounded-full bg-[#463223]/10 p-6">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="#463223" opacity="0.6">
                        <path d="M12 21s-6.716-4.35-9.333-7.2C.5 11.4 1.1 7.6 4.5 6.6c2.3-.7 3.9.5 4.9 1.7 1-1.2 2.6-2.4 4.9-1.7 3.4 1 4 4.8 1.8 7.2C18.716 16.65 12 21 12 21z" />
                    </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#463223]" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 700}}>
                    Избранное пусто
                </h3>
                <p className="text-sm text-[#463223]/60" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 300}}>
                    Добавьте понравившиеся блюда в избранное для быстрого доступа
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-3 pt-4">
            {favorites.map((f) => {
                const opts = Object.entries(f.options || {})
                    .filter(([, v]) => v)
                    .map(([k]) => k);
                const isExpanded = expandedItem === f.key;
                const hasMoreThan3Options = opts.length > 3;
                
                return (
                    <div key={f.key} className="rounded-xl border border-[#463223]/10 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-start gap-4">
                            {/* Фото блюда */}
                            <div className="flex-shrink-0">
                                <img
                                    src={f.photo}
                                    alt={f.name}
                                    className="w-16 h-16 object-cover rounded-lg"
                                    onError={(e) => {
                                        console.log('❌ Favorites image failed to load:', e.target.src);
                                        // Показываем placeholder
                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRTNFM0UwIi8+CjxwYXRoIGQ9Ik04MCA3MEgxMjBWMTMwSDgwVjcwWiIgZmlsbD0iIzQ2MzIyMyIgZmlsbC1vcGFjaXR5PSIwLjMiLz4KPHBhdGggZD0iTTkwIDg1TDEwNSA5NUwxMjAgODUiIHN0cm9rZT0iIzQ2MzIyMyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPGNpcmNsZSBjeD0iOTUiIGN5PSI4NSIgcj0iNCIgZmlsbD0iIzQ2MzIyMyIvPgo8L3N2Zz4=';
                                    }}
                                />
                            </div>
                            
                            {/* Основная информация */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="font-semibold text-[#463223] text-sm leading-tight" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 700}}>
                                        {f.name}
                                    </h4>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-semibold text-[#463223]">
                                            {money(f.totalPrice ?? f.price)}
                                        </div>
                                    </div>
                                </div>
                                
                                {f.size && (
                                    <div className="mb-2 text-xs text-[#463223]/60" style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 400}}>
                                        {f.size}
                                    </div>
                                )}
                                
                                {/* Блок с опциями */}
                                {opts.length > 0 && (
                                    <div className="mb-3">
                                        <div className="space-y-1">
                                            {(isExpanded ? opts : opts.slice(0, 3)).map((opt, index) => (
                                                <div 
                                                    key={index}
                                                    className="text-xs text-[#463223]/60"
                                                    style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 400}}
                                                >
                                                    • {opt}
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Аккордеон для дополнительных опций */}
                                        {hasMoreThan3Options && (
                                            <button
                                                onClick={() => setExpandedItem(isExpanded ? null : f.key)}
                                                className="mt-1 text-xs text-[#463223]/50 hover:text-[#463223]/70 transition-colors duration-200"
                                                style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 500}}
                                            >
                                                {isExpanded ? `Скрыть (${opts.length - 3})` : `Показать еще ${opts.length - 3}`}
                                            </button>
                                        )}
                                    </div>
                                )}
                                
                                {/* Кнопка удаления - более яркая */}
                                <div>
                                    <button
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#463223] text-white px-3 py-1.5 text-xs transition-all duration-200 hover:bg-[#463223]/90 hover:shadow-md active:scale-95"
                                        onClick={() => setFavorites((prev) => prev.filter((x) => x.key !== f.key))}
                                        style={{fontFamily: 'Montserrat, sans-serif', fontWeight: 600}}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                                        </svg>
                                        Убрать
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
