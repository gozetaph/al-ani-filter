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
    <div className="space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            إدارة الفلاتر والمنتجات (الكتالوج)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إضافة فلاتر جديدة، تحديد كود القطعة، وتعبئة أرقام الماركات البديلة (الماركات الأخرى)
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#004bb5] hover:bg-[#00388a] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5"
        >
          <span>+ إضافة فلتر جديد</span>
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            قائمة الفلاتر في الكتالوج ({items.length} فلتر)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">صورة الفلتر</th>
                <th className="p-3.5">كود الفلتر</th>
                <th className="p-3.5">الاسم والوصف</th>
                <th className="p-3.5">النوع / التصنيف</th>
                <th className="p-3.5">الماركات الأخرى</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {items.map((item) => {
                const pNum = item.part_number || item.title.split(" ").pop() || "AL-ANI";
                const brands = item.other_brands || [];
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">
                      <div className="w-12 h-12 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-1">
                        <Image
                          src={item.image_url || "/products/oil-filter.svg"}
                          alt={item.title}
                          width={44}
                          height={44}
                          className="max-h-10 w-auto object-contain"
                        />
                      </div>
                    </td>
                    <td className="p-3.5 font-black text-slate-900 text-sm font-mono">
                      {pNum}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 text-xs sm:text-sm">
                      {item.title}
                      <span className="block text-[11px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                        {item.description}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-blue-50 text-[#004bb5] font-bold text-[11px] px-2.5 py-1 rounded-md border border-blue-200/80">
                        {item.clean_type || item.type || item.category || "فلتر"}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-slate-600">
                      {brands.length > 0 ? (
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {brands.slice(0, 3).map((b, i) => (
                            <div key={i}>
                              <span className="font-bold text-slate-800">{b.brand}:</span> {b.code}
                            </div>
                          ))}
                          {brands.length > 3 && (
                            <span className="text-slate-400">+{brands.length - 3} ماركات أخرى...</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-sans text-[11px]">مطابقة حسب الطلب</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-lg transition"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900">إضافة فلتر جديد للكتالوج</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود القطعة (Part Number) *</label>
                  <input
                    type="text"
                    required
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="مثال: SP 002 HT أو W 67/1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع الفلتر / القسم *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:bg-white transition"
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
                <label className="block font-bold text-slate-700 mb-1">اسم الفلتر / العنوان *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: فلتر دهن زيت أصلي مطابق لمواصفات OEM"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف الفلتر وملاحظات</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="الآليات المتوافقة، كفاءة الترشيح..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white transition"
                />
              </div>

              {/* OTHER BRANDS SECTION */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 block text-xs">
                    الماركات الأخرى (أرقام المطابقة البديلة)
                  </label>
                  <button
                    type="button"
                    onClick={addBrandRow}
                    className="text-[#004bb5] hover:underline font-bold text-[11px]"
                  >
                    + إضافة ماركة أخرى
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  اكتب اسم الماركة في الحقل الأول والكود المطابق في الحقل الثاني لتظهر للزبون بالترتيب:
                </p>

                <div className="space-y-2">
                  {otherBrands.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={b.brand}
                        onChange={(e) => handleBrandChange(idx, "brand", e.target.value)}
                        placeholder="الماركة (مثال: Perkins)"
                        className="w-1/2 bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        value={b.code}
                        onChange={(e) => handleBrandChange(idx, "code", e.target.value)}
                        placeholder="كود القطعة (مثال: 2654403)"
                        className="w-1/2 bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removeBrandRow(idx)}
                        className="w-7 h-7 text-rose-500 hover:bg-rose-100 rounded flex items-center justify-center font-bold shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* IMAGE UPLOAD */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">صورة الفلتر</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#004bb5] hover:file:bg-blue-100"
                  />
                  
                  <div className="text-[11px] text-slate-400">
                    أو اختر صورة نموذجية:
                  </div>
                  <select
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs"
                  >
                    <option value="/products/asas/sp_001.jpg">فلتر دهن أسطواني أسود (SP 001)</option>
                    <option value="/products/asas/sp_002_ht.jpg">فلتر دهن أسطواني قصير (SP 002)</option>
                    <option value="/products/asas/sp_004.jpg">فلتر دهن أسطواني كبير (SP 004)</option>
                    <option value="/products/asas/hires/fuel_water_01.webp">فلتر ديزل وفاصل ماء مع صمام</option>
                    <option value="/products/asas/hires/air_filter_radial.webp">فلتر هواء دائري Radial Seal</option>
                    <option value="/products/asas/hires/air_dryer_cartridge.webp">فلتر مجفف هواء شاحنات</option>
                    <option value="/products/asas/hires/cabin_filter_05.webp">فلتر كابينة وتكييف مستطيل</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-[#004bb5] hover:bg-[#00388a] text-white px-5 py-2 rounded-xl font-bold shadow-xs transition"
                >
                  {isUploading ? "جاري الإضافة والرفع..." : "حفظ الفلتر"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
