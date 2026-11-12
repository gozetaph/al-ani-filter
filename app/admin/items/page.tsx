"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Product, BrandCrossReference } from "@/lib/types";
import { initialProducts } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function AdminItemsPage() {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form State: Name, Part Number, Type, Description, Picture, Other Brands
  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [type, setType] = useState("فلتر دهن (زيت)");
  const [desc, setDesc] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("/products/asas/sp_001.jpg");

  // Other Brands input list: [{ brand: 'Mann', code: 'W 67/1' }, ...]
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
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
          }
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

  // Handle Add Item (With Supabase Storage Upload)
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    let finalImageUrl = imageUrl;

    // Upload to Supabase Storage if file was picked
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

    // Save to Supabase
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

    const updated = [newItem, ...items];
    setItems(updated);
    try {
      localStorage.setItem("al_ani_custom_items", JSON.stringify(updated));
    } catch {
      // ignore
    }

    setIsAddModalOpen(false);
    setIsUploading(false);

    // Reset Form
    setName("");
    setPartNumber("");
    setType("فلتر دهن (زيت)");
    setDesc("");
    setImageFile(null);
    setOtherBrands([
      { brand: "Mann • Hummel", code: "" },
      { brand: "AL ANI", code: "" },
      { brand: "MAK", code: "" },
      { brand: "PERKINS", code: "" },
      { brand: "Fleetguard", code: "" },
    ]);

    alert("تمت إضافة الفلتر بنجاح إلى الكتالوج!");
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

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">
            إدارة المنتجات والكتالوج
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            إضافة فلاتر جديدة وتعبئة أرقام الماركات البديلة
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#004bb5] hover:bg-[#1a5fc8] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          + إضافة فلتر جديد
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-[#1a1d27] border border-white/8 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">
            قائمة الفلاتر في الكتالوج ({items.length} فلتر)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-white/8 text-zinc-500 font-semibold">
              <tr>
                <th className="p-3.5">صورة الفلتر</th>
                <th className="p-3.5">كود الفلتر</th>
                <th className="p-3.5">الاسم والوصف</th>
                <th className="p-3.5 hidden sm:table-cell">النوع</th>
                <th className="p-3.5 hidden md:table-cell">الماركات الأخرى</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {items.map((item) => {
                const pNum = item.part_number || item.title.split(" ").pop() || "AL-ANI";
                const brands = item.other_brands || [];
                return (
                  <tr key={item.id} className="hover:bg-white/4 transition">
                    <td className="p-3.5">
                      <div className="w-11 h-11 bg-white/6 rounded-lg border border-white/8 flex items-center justify-center p-1">
                        <Image
                          src={item.image_url || "/products/oil-filter.svg"}
                          alt={item.title}
                          width={44}
                          height={44}
                          className="max-h-9 w-auto object-contain"
                        />
                      </div>
                    </td>
                    <td className="p-3.5 font-black text-white text-sm font-mono">
                      {pNum}
                    </td>
                    <td className="p-3.5 font-semibold text-zinc-200">
                      {item.title}
                      <span className="block text-[11px] text-zinc-600 font-normal line-clamp-1 mt-0.5">
                        {item.description}
                      </span>
                    </td>
                    <td className="p-3.5 hidden sm:table-cell">
                      <span className="bg-blue-500/15 text-blue-400 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-blue-500/20">
                        {item.clean_type || item.type || item.category || "فلتر"}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-zinc-500 hidden md:table-cell">
                      {brands.length > 0 ? (
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {brands.slice(0, 3).map((b, i) => (
                            <div key={i}>
                              <span className="font-bold text-zinc-300">{b.brand}:</span> {b.code}
                            </div>
                          ))}
                          {brands.length > 3 && (
                            <span className="text-zinc-600">+{brands.length - 3} أخرى</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-[11px]">حسب الطلب</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD ITEM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8">
            
            <div className="p-4 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">إضافة فلتر جديد للكتالوج</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/14 flex items-center justify-center text-zinc-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4 text-xs" dir="rtl">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-400 mb-1">كود القطعة *</label>
                  <input
                    type="text"
                    required
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="SP 002 HT"
                    className="w-full bg-white/6 border border-white/10 rounded-xl p-2.5 text-xs font-mono font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-400 mb-1">نوع الفلتر *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-white/6 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-zinc-200 focus:outline-none focus:border-blue-500/50 transition cursor-pointer"
                  >
                    <option value="فلتر دهن (زيت)">فلتر دهن (زيت)</option>
                    <option value="فلتر هواء سيارات ومعدات">فلتر هواء</option>
                    <option value="فلتر وقود ديزل وسبيتر">فلتر وقود</option>
                    <option value="فلتر مجفف هواء للشاحنات">مجفف هواء</option>
                    <option value="فلتر كابينة ومكيف">فلتر كابينة</option>
                    <option value="فلتر هيدروليك">فلتر هيدروليك</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-400 mb-1">اسم الفلتر *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="فلتر دهن زيت أصلي مطابق OEM"
                  className="w-full bg-white/6 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-400 mb-1">وصف وملاحظات</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="الآليات المتوافقة، كفاءة الترشيح..."
                  className="w-full bg-white/6 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition"
                />
              </div>

              {/* Brands */}
              <div className="p-3 bg-white/4 rounded-xl border border-white/8 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-zinc-300 text-xs">الماركات الأخرى (أرقام المطابقة)</label>
                  <button type="button" onClick={addBrandRow} className="text-blue-400 hover:text-blue-300 font-bold text-[11px] cursor-pointer">
                    + إضافة ماركة
                  </button>
                </div>
                <div className="space-y-2">
                  {otherBrands.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={b.brand}
                        onChange={(e) => handleBrandChange(idx, "brand", e.target.value)}
                        placeholder="الماركة"
                        className="w-1/2 bg-white/6 border border-white/10 rounded-lg p-2 text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={b.code}
                        onChange={(e) => handleBrandChange(idx, "code", e.target.value)}
                        placeholder="الكود"
                        className="w-1/2 bg-white/6 border border-white/10 rounded-lg p-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none"
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

              {/* Image */}
              <div>
                <label className="block font-bold text-zinc-400 mb-1">صورة الفلتر</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-500/15 file:text-blue-400 hover:file:bg-blue-500/25 cursor-pointer"
                />
                <select
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="mt-2 w-full bg-white/6 border border-white/10 rounded-xl p-2 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="/products/asas/sp_001.jpg">فلتر دهن أسطواني (SP 001)</option>
                  <option value="/products/asas/sp_002_ht.jpg">فلتر دهن قصير (SP 002)</option>
                  <option value="/products/asas/sp_004.jpg">فلتر دهن كبير (SP 004)</option>
                  <option value="/products/asas/hires/fuel_water_01.webp">فلتر ديزل وفاصل ماء</option>
                  <option value="/products/asas/hires/air_filter_radial.webp">فلتر هواء Radial</option>
                  <option value="/products/asas/hires/air_dryer_cartridge.webp">مجفف هواء شاحنات</option>
                  <option value="/products/asas/hires/cabin_filter_05.webp">فلتر كابينة</option>
                </select>
              </div>

              <div className="pt-3 border-t border-white/8 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/6 font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-[#004bb5] hover:bg-[#1a5fc8] text-white px-5 py-2 rounded-xl font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? "جاري الإضافة..." : "حفظ الفلتر"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
