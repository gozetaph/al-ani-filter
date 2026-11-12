"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Product, BrandCrossReference } from "@/lib/types";
import { initialProducts } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function TailAdminItemsPage() {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  // Form State
  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [type, setType] = useState("فلتر دهن (زيت)");
  const [desc, setDesc] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("/products/asas/sp_001.jpg");

  const [otherBrands, setOtherBrands] = useState<BrandCrossReference[]>([
    { brand: "Mann • Hummel", code: "" },
    { brand: "AL ANI", code: "" },
    { brand: "MAK", code: "" },
    { brand: "PERKINS", code: "" },
    { brand: "Fleetguard", code: "" },
  ]);

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

  // Brand Row Handlers
  const handleBrandChange = (index: number, field: "brand" | "code", val: string) => {
    setOtherBrands((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const addBrandRow = () => {
    setOtherBrands((prev) => [...prev, { brand: "", code: "" }]);
  };

  const removeBrandRow = (index: number) => {
    setOtherBrands((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingItem(null);
    setName("");
    setPartNumber("");
    setType("فلتر دهن (زيت)");
    setDesc("");
    setImageFile(null);
    setImageUrl("/products/asas/sp_001.jpg");
    setOtherBrands([
      { brand: "Mann • Hummel", code: "" },
      { brand: "AL ANI", code: "" },
      { brand: "MAK", code: "" },
      { brand: "PERKINS", code: "" },
      { brand: "Fleetguard", code: "" },
    ]);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (item: Product) => {
    setEditingItem(item);
    setName(item.title);
    setPartNumber(item.part_number || item.title.split(" ").pop() || "");
    setType(item.clean_type || item.type || "فلتر دهن (زيت)");
    setDesc(item.description || "");
    setImageUrl(item.image_url || "/products/asas/sp_001.jpg");
    setImageFile(null);

    const brands = item.other_brands && item.other_brands.length > 0
      ? item.other_brands
      : [
          { brand: "Mann • Hummel", code: "" },
          { brand: "AL ANI", code: "" },
          { brand: "MAK", code: "" },
          { brand: "PERKINS", code: "" },
          { brand: "Fleetguard", code: "" },
        ];
    setOtherBrands(brands);
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
        console.error("Storage upload failed, using fallback:", err);
      }
    }

    const filteredBrands = otherBrands.filter(
      (b) => b.brand.trim() !== "" || b.code.trim() !== ""
    );

    if (editingItem) {
      // Update existing item
      const updatedItem: Product = {
        ...editingItem,
        title: name || `فلتر ${partNumber}`,
        part_number: partNumber,
        description: desc,
        type: type,
        clean_type: type,
        image_url: finalImageUrl,
        other_brands: filteredBrands,
      };

      const updatedList = items.map((i) => (i.id === editingItem.id ? updatedItem : i));
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
            title: updatedItem.title,
            description: updatedItem.description,
            type: updatedItem.type,
            image_url: updatedItem.image_url,
            part_number: updatedItem.part_number,
            specs: { other_brands: updatedItem.other_brands },
          })
          .eq("id", editingItem.id);
      } catch {
        // Handled
      }
    } else {
      // Add new item
      const newItem: Product = {
        id: "prod-" + Date.now(),
        title: name || `فلتر ${partNumber}`,
        part_number: partNumber,
        slug: "item-" + Date.now(),
        description: desc,
        type: type,
        category: type.includes("دهن") ? "oil" : type.includes("هواء") ? "air" : type.includes("وقود") ? "fuel" : "other",
        clean_type: type,
        image_url: finalImageUrl,
        other_brands: filteredBrands,
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
            specs: { other_brands: newItem.other_brands },
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
    if (!confirm("هل أنت متأكد من حذف هذا الفلتر نهائياً من الكتالوج؟")) return;

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

  const categories = ["الكل", "دهن", "هواء", "وقود", "مجفف", "كابينة"];

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* ── TOP HEADER BAR ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            إدارة الفلاتر والمنتجات
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            عرض، إضافة، وتعديل بيانات الفلاتر وأرقام الماركات البديلة
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          <span>+ إضافة فلتر جديد</span>
        </button>
      </div>

      {/* ── SEARCH & FILTER CONTROLS BAR (TailAdmin style) ──────────── */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بكود القطعة أو الاسم..."
            className="w-full pr-10 pl-4 py-2 bg-gray-800/80 border border-gray-700/60 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition font-mono"
          />
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {cat === "الكل" ? "جميع الفئات" : `فلاتر ${cat}`}
              </button>
            );
          })}
        </div>

      </div>

      {/* ── TAILADMIN TABLE ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">
            قائمة الفلاتر ({filteredItems.length} من أصل {items.length})
          </h3>
          <span className="text-[11px] text-gray-500 font-mono">
            {filteredItems.length} فلتر معروض
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-950/60 border-b border-gray-800 text-gray-400 font-semibold">
              <tr>
                <th className="p-4">الصورة</th>
                <th className="p-4">كود الفلتر</th>
                <th className="p-4">اسم الفلتر</th>
                <th className="p-4 hidden sm:table-cell">القسم</th>
                <th className="p-4 hidden md:table-cell">الماركات الأخرى</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500">
                    لا توجد فلاتر مطابقة لبحثك
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const pNum = item.part_number || item.title.split(" ").pop() || "AL-ANI";
                  const brands = item.other_brands || [];
                  return (
                    <tr key={item.id} className="hover:bg-gray-800/40 transition">
                      <td className="p-4">
                        <div className="w-12 h-12 bg-gray-800 rounded-xl border border-gray-700/60 flex items-center justify-center p-1">
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

                      <td className="p-4 font-bold text-gray-200">
                        {item.title}
                        <span className="block text-[11px] text-gray-500 font-normal line-clamp-1 mt-0.5">
                          {item.description}
                        </span>
                      </td>

                      <td className="p-4 hidden sm:table-cell">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                          {item.clean_type || item.type || "فلتر أصلي"}
                        </span>
                      </td>

                      <td className="p-4 text-gray-400 font-mono text-[11px] hidden md:table-cell">
                        {brands.length > 0 ? (
                          <div className="space-y-0.5">
                            {brands.slice(0, 3).map((b, i) => (
                              <div key={i}>
                                <span className="font-bold text-gray-200">{b.brand}:</span> {b.code}
                              </div>
                            ))}
                            {brands.length > 3 && (
                              <span className="text-gray-500">+{brands.length - 3} ماركات أخرى...</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 font-sans">مطابقة حسب الطلب</span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 font-bold rounded-lg transition border border-gray-700 cursor-pointer"
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

      {/* ── TAILADMIN FORM MODAL: ADD / EDIT FILTER ──────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8 animate-scaleUp">
            
            <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingItem ? "تعديل بيانات الفلتر" : "إضافة فلتر جديد للكتالوج"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white font-bold cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 text-xs" dir="rtl">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">كود القطعة (Part Number) *</label>
                  <input
                    type="text"
                    required
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="مثال: SP 002 HT"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-300 mb-1">نوع الفلتر / القسم *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 text-xs font-bold text-gray-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
                  >
                    <option value="فلتر دهن (زيت)">فلتر دهن (زيت)</option>
                    <option value="فلتر هواء سيارات ومعدات">فلتر هواء سيارات ومعدات</option>
                    <option value="فلتر وقود ديزل وسبيتر">فلتر وقود ديزل وسبيتر</option>
                    <option value="فلتر مجفف هواء للشاحنات">فلتر مجفف هواء للشاحنات</option>
                    <option value="فلتر كابينة ومكيف">فلتر كابينة ومكيف</option>
                    <option value="فلتر هيدروليك">فلتر هيدروليك</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-300 mb-1">اسم الفلتر / العنوان *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="فلتر دهن أصلي مطابق لمواصفات OEM"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-300 mb-1">الوصف وملاحظات المطابقة</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="الآليات المتوافقة، كفاءة الترشيح، بلد المنشأ..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition leading-relaxed font-medium"
                />
              </div>

              {/* DYNAMIC BRANDS LIST */}
              <div className="p-3.5 bg-gray-800/60 rounded-xl border border-gray-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white text-xs">
                    الماركات الأخرى (أرقام المطابقة البديلة)
                  </label>
                  <button
                    type="button"
                    onClick={addBrandRow}
                    className="text-blue-400 hover:text-blue-300 font-bold text-[11px] cursor-pointer"
                  >
                    + إضافة ماركة
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  اكتب اسم الماركة في الحقل الأول والكود في الحقل الثاني لتظهر مرتبة للزبائن:
                </p>

                <div className="space-y-2">
                  {otherBrands.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={b.brand}
                        onChange={(e) => handleBrandChange(idx, "brand", e.target.value)}
                        placeholder="الماركة (مثل Perkins)"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={b.code}
                        onChange={(e) => handleBrandChange(idx, "code", e.target.value)}
                        placeholder="الكود (مثل 2654403)"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeBrandRow(idx)}
                        className="w-7 h-7 text-rose-400 hover:bg-rose-500/20 rounded flex items-center justify-center font-bold shrink-0 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* IMAGE UPLOADER / PRESET */}
              <div>
                <label className="block font-bold text-gray-300 mb-1">صورة الفلتر</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 cursor-pointer"
                  />
                  <select
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2 text-xs text-gray-300 focus:outline-none cursor-pointer"
                  >
                    <option value="/products/asas/sp_001.jpg">فلتر دهن أسطواني أسود (SP 001)</option>
                    <option value="/products/asas/sp_002_ht.jpg">فلتر دهن قصير (SP 002)</option>
                    <option value="/products/asas/sp_004.jpg">فلتر دهن كبير (SP 004)</option>
                    <option value="/products/asas/hires/fuel_water_01.webp">فلتر ديزل وفاصل ماء مع صمام</option>
                    <option value="/products/asas/hires/air_filter_radial.webp">فلتر هواء دائري Radial Seal</option>
                    <option value="/products/asas/hires/air_dryer_cartridge.webp">فلتر مجفف هواء شاحنات</option>
                    <option value="/products/asas/hires/cabin_filter_05.webp">فلتر كابينة وتكييف مستطيل</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:bg-gray-800 font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? "جاري الحفظ..." : editingItem ? "حفظ التعديلات" : "إضافة الفلتر"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
