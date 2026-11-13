"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";
import { initialProducts } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function AdminStockItemsPage() {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  // Form State: Strictly Photo, Description, Manufacturer (Mann vs Other), plus Title/Code
  const [partNumber, setPartNumber] = useState("");
  const [desc, setDesc] = useState("");
  const [manufacturer, setManufacturer] = useState<"Mann Filter" | "Other Producers">("Mann Filter");
  const [category, setCategory] = useState("فلاتر دهن (زيت)");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("/products/oil-filter.svg");

  const supabase = createClient();

  useEffect(() => {
    async function loadItems() {
      // 1. Try local storage
      const cached = localStorage.getItem("al_ani_custom_items");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
        } catch {
          // ignore
        }
      }

      // 2. Query Supabase
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setItems(data);
        }
      } catch {
        // Fallback
      }
    }
    loadItems();
  }, [supabase]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingItem(null);
    setPartNumber("");
    setDesc("");
    setManufacturer("Mann Filter");
    setCategory("فلاتر دهن (زيت)");
    setImageFile(null);
    setImageUrl("/products/oil-filter.svg");
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (item: Product) => {
    setEditingItem(item);
    setPartNumber(item.part_number || item.title || "");
    setDesc(item.description || "");
    const isMann = (item.description || "").includes("Mann") || (item.title || "").includes("Mann");
    setManufacturer(isMann ? "Mann Filter" : "Other Producers");
    setCategory(item.type || item.clean_type || "فلاتر دهن (زيت)");
    setImageUrl(item.image_url || "/products/oil-filter.svg");
    setImageFile(null);
    setIsModalOpen(true);
  };

  // Handle Save (Add or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    let finalImageUrl = imageUrl;

    // Handle Image Upload if file selected
    if (imageFile) {
      try {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `items/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            finalImageUrl = publicUrlData.publicUrl;
          }
        }
      } catch (err) {
        console.warn("Storage upload error fallback:", err);
      }
    }

    const mfrLabel = manufacturer === "Mann Filter" ? "مان فلتـر (Mann Filter)" : "منتجون آخرون (Other Producers)";
    const enrichedDesc = desc.trim() || `فلتر أصلي من إنتاج ${mfrLabel}`;

    if (editingItem) {
      // Update existing item
      const updated: Product = {
        ...editingItem,
        title: partNumber ? `فلتر ${partNumber}` : editingItem.title,
        part_number: partNumber,
        description: enrichedDesc,
        type: category,
        clean_type: category,
        image_url: finalImageUrl,
      };

      const updatedList = items.map((i) => (i.id === editingItem.id ? updated : i));
      setItems(updatedList);
      try {
        localStorage.setItem("al_ani_custom_items", JSON.stringify(updatedList));
      } catch {
        // ignore
      }

      try {
        await supabase
          .from("products")
          .update({
            title: updated.title,
            part_number: updated.part_number,
            description: updated.description,
            type: updated.type,
            image_url: updated.image_url,
          })
          .eq("id", editingItem.id);
      } catch {
        // Handled
      }
    } else {
      // Create new item
      const newItem: Product = {
        id: "item-" + Date.now(),
        title: partNumber ? `فلتر ${partNumber}` : "فلتر أصلي جديد",
        part_number: partNumber,
        slug: "item-" + Date.now(),
        description: enrichedDesc,
        type: category,
        clean_type: category,
        image_url: finalImageUrl,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const updatedList = [newItem, ...items];
      setItems(updatedList);
      try {
        localStorage.setItem("al_ani_custom_items", JSON.stringify(updatedList));
      } catch {
        // ignore
      }

      try {
        await supabase.from("products").insert([
          {
            title: newItem.title,
            slug: newItem.slug,
            description: newItem.description,
            type: newItem.type,
            image_url: newItem.image_url,
            part_number: newItem.part_number,
            is_active: true,
          },
        ]);
      } catch {
        // Handled
      }
    }

    setIsModalOpen(false);
    setIsUploading(false);
  };

  const deleteItem = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المادة نهائياً من المخزون؟")) return;

    try {
      await supabase.from("products").delete().eq("id", id);
    } catch (err) {
      console.error("Delete DB error:", err);
    }

    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    try {
      localStorage.setItem("al_ani_custom_items", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const categories = [
    "الكل",
    "فلاتر دهن (زيت)",
    "فلاتر هواء",
    "فلاتر وقود (ديزل)",
    "فلاتر مجفف هواء للشاحنات",
    "فلاتر كابينة ومكيف",
    "فلاتر هيدروليك",
  ];

  // Filter items by category & search
  const filteredItems = items.filter((item) => {
    const matchesCategory =
      selectedCategory === "الكل" ||
      (item.type || item.category || "").includes(selectedCategory.replace("فلاتر ", ""));

    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.part_number && item.part_number.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 text-right" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      
      {/* ── TOP HEADER BAR ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            مخزون المواد والفلاتر
          </h1>
          <p className="text-xs text-neutral-400 mt-1 font-semibold">
            عرض وإدارة مواد الكتالوج والمخزون مباشرة كما هي
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          <span>+ إضافة مادة جديدة</span>
        </button>
      </div>

      {/* ── SEARCH & CATEGORY DROPDOWN MENU ─────────────────────────── */}
      <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم القطعة أو الوصف..."
            className="w-full pr-10 pl-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition font-mono"
          />
        </div>

        {/* Category Dropdown Menu (Replaces horizontal tabs) */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <label className="text-xs font-bold text-neutral-400 shrink-0">
            تصنيف الفئة:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-64 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "الكل" ? "جميع الفئات (الكل)" : cat}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* ── STOCK OF ITEMS TABLE (As-is, no stock amount numbers) ───── */}
      <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">
            قائمة المواد ({filteredItems.length} مادة)
          </h3>
          <span className="text-[11px] text-neutral-400 font-mono">
            {filteredItems.length} مادة معروضة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 font-semibold">
              <tr>
                <th className="p-4">الصورة</th>
                <th className="p-4">كود أو اسم المادة</th>
                <th className="p-4">الشركة المصنعة</th>
                <th className="p-4 hidden sm:table-cell">الفئة</th>
                <th className="p-4 hidden md:table-cell">الوصف</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80 text-neutral-300">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-neutral-500 font-medium">
                    لا توجد مواد مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const pNum = item.part_number || item.title || "AL-ANI";
                  const isMann = (item.description || "").includes("Mann") || (item.title || "").includes("Mann");
                  return (
                    <tr key={item.id} className="hover:bg-neutral-900/50 transition">
                      <td className="p-4">
                        <div className="w-12 h-12 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-center p-1">
                          <Image
                            src={item.image_url || "/products/oil-filter.svg"}
                            alt={item.title}
                            width={48}
                            height={48}
                            className="max-h-10 w-auto object-contain"
                          />
                        </div>
                      </td>

                      <td className="p-4 font-black text-white text-sm font-mono">
                        {pNum}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          isMann
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}>
                          {isMann ? "مان فلتـر (Mann)" : "منتجون آخرون"}
                        </span>
                      </td>

                      <td className="p-4 hidden sm:table-cell">
                        <span className="bg-neutral-900 text-neutral-300 border border-neutral-800 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          {item.clean_type || item.type || "فلتر أصلي"}
                        </span>
                      </td>

                      <td className="p-4 text-neutral-400 text-xs hidden md:table-cell max-w-xs">
                        <span className="line-clamp-2">
                          {item.description || "مطابقة هندسية دقيقة"}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-blue-400 font-bold rounded-lg transition border border-neutral-800 cursor-pointer"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg transition border border-rose-500/20 cursor-pointer"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD / EDIT ITEM MODAL ─────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8 animate-scaleUp">
            
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingItem ? "تعديل المادة" : "إضافة مادة جديدة للمخزون"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white font-bold cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 text-xs" dir="rtl">
              
              {/* Part Code / Identifier */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1">كود أو اسم المادة *</label>
                <input
                  type="text"
                  required
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="مثال: W 950 / W 712 / SP 001"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Manufacturer Selector: Mann vs Other Producers */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1">الشركة المصنعة *</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setManufacturer("Mann Filter")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      manufacturer === "Mann Filter"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
                    }`}
                  >
                    <span>مان فلتـر (Mann)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setManufacturer("Other Producers")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      manufacturer === "Other Producers"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
                    }`}
                  >
                    <span>منتجون آخرون (Other)</span>
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1">القسم / التصنيف</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs font-bold text-neutral-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
                >
                  <option value="فلاتر دهن (زيت)">فلاتر دهن (زيت)</option>
                  <option value="فلاتر هواء">فلاتر هواء</option>
                  <option value="فلاتر وقود (ديزل)">فلاتر وقود (ديزل)</option>
                  <option value="فلاتر مجفف هواء للشاحنات">فلاتر مجفف هواء للشاحنات</option>
                  <option value="فلاتر كابينة ومكيف">فلاتر كابينة ومكيف</option>
                  <option value="فلاتر هيدروليك">فلاتر هيدروليك</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1">الوصف وملاحظات المادة</label>
                <textarea
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="الوصف، الاستخدام، التوافق، بلد المنشأ..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition leading-relaxed font-medium"
                />
              </div>

              {/* Picture / Photo: File upload + Preset/URL fallback */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1">صورة المادة (Photo / Picture)</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 cursor-pointer"
                  />
                  <select
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2 text-xs text-neutral-300 focus:outline-none cursor-pointer"
                  >
                    <option value="/products/oil-filter.svg">صورة افتراضية (فلتر دهن)</option>
                    <option value="/products/asas/sp_001.jpg">فلتر أسطواني أسود (SP 001)</option>
                    <option value="/products/asas/sp_002_ht.jpg">فلتر قصير (SP 002)</option>
                    <option value="/products/asas/sp_004.jpg">فلتر كبير (SP 004)</option>
                    <option value="/products/asas/hires/fuel_water_01.webp">فلتر ديزل وفاصل ماء</option>
                    <option value="/products/asas/hires/air_filter_radial.webp">فلتر هواء دائري</option>
                    <option value="/products/asas/hires/air_dryer_cartridge.webp">مجفف هواء شاحنات</option>
                    <option value="/products/asas/hires/cabin_filter_05.webp">فلتر كابينة ومكيف</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:bg-neutral-900 font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? "جاري الحفظ..." : editingItem ? "حفظ التعديلات" : "إضافة المادة"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
