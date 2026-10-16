export const TAMANO_PAGINA = 24;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Normaliza los searchParams de la tienda a los parámetros de fn_tienda_catalogo_listar.
export function leerFiltros(sp) {
  const uuid = (v) => (typeof v === "string" && UUID.test(v) ? v : null);
  const q = typeof sp?.q === "string" ? sp.q.trim() : "";
  const pagina = Number.parseInt(sp?.pagina, 10);
  return {
    q,
    categoria: uuid(sp?.categoria),
    rubro: uuid(sp?.rubro),
    marca: uuid(sp?.marca),
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
    ofertas: sp?.ofertas === "1",
  };
}

export async function listarCatalogo(supabase, f) {
  const { data, error } = await supabase.rpc("fn_tienda_catalogo_listar", {
    p_busqueda: f.q || null,
    p_id_categoria: f.categoria,
    p_id_rubro: f.rubro,
    p_id_marca: f.marca,
    p_pagina: f.pagina,
    p_solo_ofertas: Boolean(f.ofertas),
    p_solo_destacados: Boolean(f.destacados),
  });
  if (error) return { items: [], total: 0, error: true };
  const items = data ?? [];
  return { items, total: Number(items[0]?.total_resultados ?? 0), error: false };
}

// { categorias: [{id, nombre}], rubros: [...], marcas: [...] }
export async function listarFiltros(supabase) {
  const { data } = await supabase.rpc("fn_tienda_filtros_listar");
  const out = { categorias: [], rubros: [], marcas: [] };
  for (const r of data ?? []) {
    const lista = { categoria: out.categorias, rubro: out.rubros, marca: out.marcas }[r.tipo];
    lista?.push({ id: r.id, nombre: r.nombre });
  }
  return out;
}

export function esUuid(v) {
  return typeof v === "string" && UUID.test(v);
}

// Devuelve el artículo o null si no existe / no está publicado / no tiene precio vigente.
export async function obtenerProducto(supabase, id) {
  const { data, error } = await supabase.rpc("fn_tienda_producto_obtener", { p_id_producto: id });
  if (error) return { producto: null, error: true };
  return { producto: data?.[0] ?? null, error: false };
}
