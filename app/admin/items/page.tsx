"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { formatIQD } from "@/lib/utils";
import { Product } from "@/lib/types";
import { initialProducts } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function AdminItemsPage() {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form State: Name, Type, Description, Price, Stock, Picture
  const [name, setName] = useState("");
  const [type, setType] = useState("منظومات R.O");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(15000);
  const [stock, setStock] = useState(10);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("/products/ro-system.jpg");

  const supabase = createClient();

  useEffect(() => {
    async function loadItems() {
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

    const newItem: Product = {
      id: "prod-" + Date.now(),
      title: name,
      slug: "item-" + Date.now(),
      description: desc,
      type: type,
      category: type,
      price: Number(price),
      stock_quantity: Number(stock),
      image_url: finalImageUrl,
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
          price: newItem.price,
          stock_quantity: newItem.stock_quantity,
          image_url: newItem.image_url,
          is_active: true,
        },
      ]);
    } catch {
      // Handled
    }

    setItems((prev) => [newItem, ...prev]);
    setIsAddModalOpen(false);
    setIsUploading(false);

    // Reset Form
    setName("");
    setType("منظومات R.O");
    setDesc("");
    setPrice(15000);
    setStock(10);
    setImageFile(null);

    alert("تمت إضافة المادة بنجاح إلى المخزن والمتجر!");
  };

  const updateStock = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, stock_quantity: Math.max(0, i.stock_quantity + delta) } : i
      )
    );
  };

  const deleteItem = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المادة نهائياً من المتجر والمخزن؟")) return;

    try {
      await supabase.from("products").delete().eq("id", id);
    } catch (err) {
      console.error("Delete DB error:", err);
    }

    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            إدارة المواد والمنتجات
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            عرض المواد المتوفرة، تصنيفها، وتحديث المخزون وإضافة بضاعة جديدة
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#004bb5] hover:bg-[#00388a] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5"
        >
          <span>+ إضافة مادة جديدة</span>
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            قائمة المواد في المستودع ({items.length} مادة)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">صورة المادة</th>
                <th className="p-3.5">اسم المادة</th>
                <th className="p-3.5">النوع / التصنيف</th>
                <th className="p-3.5">السعر (IQD)</th>
                <th className="p-3.5">المتوفر بالمخزن</th>
                <th className="p-3.5 text-center">الكمية</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition">
                  <td className="p-3.5">
                    <div className="w-12 h-12 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-1">
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        width={44}
                        height={44}
                        className="max-h-10 w-auto object-contain"
                      />
                    </div>
                  </td>
                  <td className="p-3.5 font-bold text-slate-900 text-xs sm:text-sm">
                    {item.title}
                    <span className="block text-[11px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                      {item.description}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-blue-50 text-[#004bb5] font-bold text-[11px] px-2.5 py-1 rounded-md border border-blue-200/80">
                      {item.type || item.category || "عام"}
                    </span>
                  </td>
                  <td className="p-3.5 font-extrabold text-[#004bb5] text-xs sm:text-sm">
                    {formatIQD(item.price)}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`font-black text-xs sm:text-sm ${
                        item.stock_quantity <= 3 ? "text-amber-600" : "text-slate-900"
                      }`}
                    >
                      {item.stock_quantity} قطعة
                    </span>
                    {item.stock_quantity <= 3 && (
                      <span className="block text-[10px] text-amber-600 font-bold">
                        ⚠️ قارب على النفاد
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                      <button
                        onClick={() => updateStock(item.id, -1)}
                        className="w-6 h-6 rounded bg-white shadow-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-bold font-mono text-xs">
                        {item.stock_quantity}
                      </span>
                      <button
                        onClick={() => updateStock(item.id, 1)}
                        className="w-6 h-6 rounded bg-white shadow-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        +
                      </button>
                    </div>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD ITEM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900">إضافة مادة جديدة للمخزن</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المادة *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: فلتر 7 مراحل تايواني أصلي"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">النوع / التصنيف *</label>
                <input
                  type="text"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="مثال: منظومات R.O أو شمعات تبديل"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white transition"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  أي تصنيف تكتبه هنا سيظهر تلقائياً كزر فلترة في واجهة المتجر.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">السعر بالدينار (IQD) *</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الكمية بالمخزن *</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف المادة</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="المواصفات، الكفالة، وأماكن التركيب..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">صورة المادة</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#004bb5] hover:file:bg-blue-100"
                  />
                  
                  <div className="text-[11px] text-slate-400">
                    أو اختر صورة جاهزة من المنتجات المرفوعة:
                  </div>
                  <select
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs"
                  >
                    <option value="/products/ro-system.jpg">منظومة R.O 7 مراحل</option>
                    <option value="/products/cartridges.png">شمعات Filter Max</option>
                    <option value="/products/membrane.png">غشاء ممبرين 75G</option>
                    <option value="/products/pump.png">مضخة ماء 24V</option>
                    <option value="/products/tds-meter.png">جهاز قياس TDS</option>
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
                  {isUploading ? "جاري الإضافة والرفع..." : "حفظ المادة"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
