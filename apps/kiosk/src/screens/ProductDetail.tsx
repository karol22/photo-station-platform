/**
 * Ruta de producto: la misma pantalla de elección, con el producto de la ruta ya elegido.
 *
 * La descripción de producto (requisito 4.3) dejó de ser una pantalla propia: cuatro tarjetas
 * apiladas de especificaciones entre la persona y su foto son un peaje, no una ayuda. Todo su
 * contenido vive ahora en la hoja «qué me llevo» de la pantalla de elección, y sigue estando
 * completo: ejemplo, descripción, qué recibes, capturas, impresiones, formato, tiempo, precio,
 * restricciones, privacidad, retención, requisitos documentales y disponibilidad.
 *
 * La ruta sobrevive porque es la casa de las etapas previas al trabajo (`started`,
 * `product_selected`, `configuring`): cuando el kiosco se recarga a media elección, la sesión
 * recuperada aterriza aquí y tiene que encontrar su producto ya elegido, no una lista.
 */
import { useParams } from 'react-router-dom';
import { ChooseScreen } from './Home';

export function ProductDetailScreen() {
  const { productId } = useParams();
  return <ChooseScreen initialProductId={productId} />;
}
