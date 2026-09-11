"use client";

import { useState } from "react";
import { CabeceraComprobante } from "./alta/CabeceraComprobante";
import { FacturaCampos } from "./alta/FacturaCampos";
import { NotaDebitoCampos } from "./alta/NotaDebitoCampos";
import { NotaCreditoCampos } from "./alta/NotaCreditoCampos";
import { RemitoCampos } from "./alta/RemitoCampos";

/**
 * C-05 / S2-7 · Alta de documento de proveedor. Sobre una cabecera común
 * (`CabeceraComprobante`) despacha un formulario de detalle según la
 * `clase` del tipo elegido (factura / nota de débito / nota de crédito /
 * remito). Cada componente de campos arma su payload y llama a su propia
 * server action.
 *
 * @param {{
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   tipos: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null, clase?: string }>,
 *   productos: Array<{ id_producto: string, nombre_completo: string, codigo_producto?: string | null }>,
 *   facturas?: Array<{ id_comprobante: string, id_proveedor: string, numero_formateado: string, nombre_tipo_comprobante: string, letra: string | null }>,
 * }} props
 */
export function ComprobanteForm({ proveedores, tipos, productos, facturas = [] }) {
  const [cab, setCab] = useState({
    id_proveedor: "",
    id_tipo_comprobante: "",
    punto_venta: "",
    numero: "",
    fecha_comprobante: "",
    fecha_vencimiento: "",
    observaciones: "",
  });
  const [erroresCab, setErroresCab] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  const tipoSel = tipos.find(
    (t) => t.id_tipo_comprobante === cab.id_tipo_comprobante
  );
  const claseActual = tipoSel?.clase ?? "factura";

  function setCampo(campo, valor) {
    setCab((prev) => ({ ...prev, [campo]: valor }));
    setErroresCab((prev) => ({ ...prev, [campo]: null }));
    setErrorServer(null);
  }

  function setErrorCabecera(campo, mensaje) {
    setErroresCab((prev) => ({ ...prev, [campo]: mensaje }));
  }

  /** Valida los campos de la cabecera común. El detalle lo valida cada tipo. */
  function validarCabecera() {
    const next = {};
    if (!cab.id_proveedor) next.id_proveedor = "Elegí un proveedor.";
    if (!cab.id_tipo_comprobante) next.id_tipo_comprobante = "Elegí un tipo.";
    if (!(Number(cab.punto_venta) > 0))
      next.numero = "El punto de venta debe ser mayor a cero.";
    else if (!(Number(cab.numero) > 0))
      next.numero = "El número debe ser mayor a cero.";
    if (!cab.fecha_comprobante)
      next.fechas = "La fecha del comprobante es obligatoria.";
    else if (
      claseActual === "factura" &&
      cab.fecha_vencimiento &&
      cab.fecha_vencimiento < cab.fecha_comprobante
    )
      next.fechas = "El vencimiento no puede ser anterior al comprobante.";

    setErroresCab(next);
    return Object.keys(next).length === 0;
  }

  const comun = {
    cab,
    validarCabecera,
    setErrorCabecera,
    errorServer,
    setErrorServer,
  };

  const conAsociado = { ...comun, facturas };

  return (
    <>
      <CabeceraComprobante
        cab={cab}
        setCampo={setCampo}
        errores={erroresCab}
        proveedores={proveedores}
        tipos={tipos}
        claseActual={claseActual}
      />

      {claseActual === "nota_debito" ? (
        <NotaDebitoCampos {...conAsociado} />
      ) : claseActual === "nota_credito" ? (
        <NotaCreditoCampos {...conAsociado} />
      ) : claseActual === "remito" ? (
        <RemitoCampos {...conAsociado} productos={productos} />
      ) : (
        <FacturaCampos {...comun} productos={productos} />
      )}
    </>
  );
}
