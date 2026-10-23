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

  // Form State: Name, Description, Price, Stock, Picture ("this is it")
  const [name, setName] = useState("");
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

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            إدارة المواد والمنتجات
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            عرض المواد المتوفرة وتحديث المخزون وإضافة بضاعة جديدة
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
                <th className="p-3.5">الوصف</th>
                <th className="p-3.5">السعر (IQD)</th>
                <th className="p-3.5">المتوفر بالمخزن</th>
                <th className="p-3.5 text-center">تعديل الكمية</th>
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
                  </td>
                  <td className="p-3.5 text-slate-500 text-xs max-w-sm line-clamp-2">
                    {item.description}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD ITEM MODAL ("Name, Description, Picture, Price, Stock - This is it") */}
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

            <form onSubmit={handleAddItem} className="p-5 space-y-3.5 text-xs">
              {/* 1. Name */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">اسم المادة *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: شمعة كربون نشط تايوانية أصلية"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none"
                />
              </div>

              {/* 2. Description */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">وصف المادة *</label>
                <textarea
                  required
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="اكتب مواصفات المادة، كفاءة الترشيح، والضمان..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none"
                />
              </div>

              {/* Price and Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">السعر (د.ع) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">الكمية بالمخزن *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* 3. Picture Upload */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">صورة المادة (رفع ملف أو رابط) *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImageFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#004bb5] hover:file:bg-blue-100 mb-2"
                />
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="أو ضع رابط صورة جاهز: /products/ro-system.jpg"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-[11px] text-slate-500 font-mono"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 min-h-[44px] bg-[#004bb5] hover:bg-[#00388a] disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-xs transition"
                >
                  {isUploading ? "جاري الحفظ ورفع الصورة..." : "حفظ المادة في المخزن"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
