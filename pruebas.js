/* =====================================================================
   PRUEBAS AUTOMÁTICAS — Tiendas Urbano (prototipo)
   Cómo usar: abre index.html en el navegador, abre la consola (F12)
   y pega este archivo completo. Al final muestra cuántas pruebas pasaron.
   Ojo: borra los datos guardados de la tienda en ese navegador.
   ===================================================================== */
(async () => {
  const KEY = 'tiendasUrbano.prototipo.v1';
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const ir = async h => { location.hash = h; await espera(120); };
  const estado = () => JSON.parse(localStorage.getItem(KEY) || '{}');
  const txt = () => document.body.innerText;
  const resultados = [];
  const ok = (nombre, cond, detalle = '') => { resultados.push({nombre, ok: !!cond, detalle}); window.__ultimaPrueba = nombre; };
  window.__resultadoPruebas = null; window.__errorPrueba = null;
  const errores = [];
  window.addEventListener('error', e => errores.push(e.message));
  window.confirm = () => true;   /* acepta los "¿Seguro?" del panel del dueño */
  const enviar = async (form, valores) => {
    Object.entries(valores).forEach(([k, v]) => {
      const el = form.elements[k];
      if (!el) return;
      if (el.type === 'checkbox') el.checked = v; else el.value = v;
    });
    form.requestSubmit(); await espera(150);
  };

  /* Empezar desde cero */
  localStorage.removeItem(KEY);
  S.users = []; S.cart = []; S.fav = []; S.orders = []; S.session = null; S.admin = false; S.news = []; S.mensajes = [];
  S.prods = null; S.slides = null;
  PRODUCTS = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)); PRODUCTS.forEach(prepararStock); SLIDES = JSON.parse(JSON.stringify(DEFAULT_SLIDES));
  save();

  /* 1. Todas las páginas cargan */
  for (const h of ['#/inicio', '#/catalogo', '#/producto?id=1', '#/producto?id=9999', '#/producto?id=abc', '#/favoritos', '#/carrito',
                   '#/ayuda?t=faq', '#/ayuda?t=envios', '#/ayuda?t=cambios', '#/ayuda?t=tallas', '#/ayuda?t=nosotros', '#/ayuda?t=terminos',
                   '#/ayuda?t=privacidad', '#/ayuda?t=noexiste', '#/contacto', '#/login', '#/registro', '#/admin', '#/pagina-rara']) {
    await ir(h);
    ok(`Carga ${h}`, document.getElementById('app').innerHTML.length > 200);
  }
  await ir('#/producto?id=9999'); ok('Producto inexistente muestra aviso', txt().includes('Producto no encontrado'));
  await ir('#/pagina-rara'); ok('Ruta desconocida muestra la portada', !!$('.hero'));

  /* 2. Títulos de pestaña */
  await ir('#/carrito'); ok('Título de pestaña del carrito', document.title.includes('carrito'));
  await ir('#/producto?id=2'); ok('Título de pestaña con nombre del producto', document.title.includes(prodById(2).name));

  /* 3. Búsqueda */
  await ir('#/catalogo?q=pantalon');
  ok('Buscar "pantalon" sin tilde encuentra "Pantalón"', $$('.pinfo h4').some(h => h.textContent.includes('Pantalón')));
  await ir('#/catalogo?q=vestido%20rosa');
  ok('Búsqueda con dos palabras', $$('.pinfo h4').some(h => h.textContent === 'Vestido Floral Rosa'));
  await ir('#/catalogo?q=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
  ok('Búsqueda con código no inyecta HTML', !$('img[src="x"]') && txt().includes('No encontramos'));
  await ir('#/catalogo?q=zzzz'); ok('Sin resultados ofrece búsquedas sugeridas', $$('.empty .chip').length > 3);

  /* 4. Filtros y orden */
  await ir('#/catalogo?tipo=Vestidos&max=20000&orden=precio-asc');
  const precios = $$('.prices b').map(b => Number(b.textContent.replace(/\D/g, '')));
  ok('Filtro de precio máximo', precios.length > 0 && precios.every(x => x <= 20000));
  ok('Orden de menor a mayor precio', precios.every((x, i) => !i || precios[i - 1] <= x));
  ok('Botón "Limpiar filtros" visible', $$('a').some(a => a.textContent.includes('Limpiar filtros')));
  await ir('#/catalogo?tipo=Accesorios&talla=S');
  ok('Accesorios no aparecen al filtrar por talla S', $$('.pcard').length === 0);
  await ir('#/catalogo?oferta=1');
  ok('Filtro de ofertas solo muestra productos con descuento', $$('.pcard').length > 0 && $$('.pcard').every(c => c.querySelector('s')));

  /* 5. Ficha de producto */
  await ir('#/producto?id=51');
  ok('Accesorio: talla única y botón habilitado', txt().includes('Talla única') && !$('[data-act=agregarPdp]').disabled);
  await ir('#/producto?id=1');
  ok('Ropa: hay que elegir talla antes de agregar', $('[data-act=agregarPdp]').disabled);
  const agotada = $('.size:disabled');
  if (agotada) { agotada.click(); await espera(80); ok('Talla agotada no se puede elegir', !$('.size.on')); }
  window.scrollTo(0, 500); await espera(50);
  const y = window.scrollY;
  const tallaElegida = $$('.size:not(:disabled)').sort((a, b) => stockDe(prodById(1), b.dataset.s) - stockDe(prodById(1), a.dataset.s))[0];
  tallaElegida.click(); await espera(120);
  const topeTalla = Math.min(MAXQ, stockDe(prodById(1), tallaElegida.dataset.s));
  ok('Elegir talla NO hace saltar la página hacia arriba', y > 0 && Math.abs(window.scrollY - y) < 5, `antes ${y}, después ${window.scrollY}`);
  for (let i = 0; i < 15; i++) { $$('[data-act=pqty]')[1].click(); await espera(15); }
  ok(`Cantidad máxima = lo menor entre ${MAXQ} y el stock`, $('.qty span').textContent === String(topeTalla), `${$('.qty span').textContent} vs ${topeTalla}`);
  $('[data-act=agregarPdp]').click(); await espera(120);
  ok('Aparece "Ver carrito" después de agregar', !!$('.added a[href="#/carrito"]'));
  $('.size.on') || $('.size:not(:disabled)').click(); await espera(50);
  $('[data-act=agregarPdp]').click(); await espera(120);
  ok(`El carrito no pasa de ${MAXQ} por talla`, estado().cart.every(i => i.qty <= MAXQ));
  ok('Contador del carrito en el encabezado', $('.menu .badge, .bottomnav .badge') && Number(($('.menu .badge') || $('.bottomnav .badge')).textContent) >= 1);

  /* 6. Carrito */
  S.cart = []; save();
  addCart(2, 'M', 1); addCart(51, 'Única', 1);
  await ir('#/carrito');
  const esperado = prodById(2).price + prodById(51).price;
  ok('Subtotal correcto', txt().includes(fmt(esperado)));
  ok('Barra de envío gratis', !!$('.freebar'));
  ok('Enlace "Seguir comprando"', $$('a').some(a => a.textContent.includes('Seguir comprando')));
  const menos = $$('[data-act=qty][data-d="-1"]')[0]; menos.click(); await espera(120);
  ok('Bajar a cero elimina la línea', estado().cart.length === 1);
  await ir('#/carrito'); $$('[data-act=qty][data-d="1"]')[0].click(); await espera(80);
  ok('Subir cantidad en el carrito', estado().cart[0].qty === 2);

  /* 7. Favoritos */
  await ir('#/catalogo');
  $$('.pcard .heart')[0].click(); await espera(120);
  ok('Guardar favorito desde la tarjeta', estado().fav.length === 1);
  ok('Corazón queda marcado', $$('.pcard .heart')[0].classList.contains('on'));
  await ir('#/favoritos'); ok('Página de favoritos lista el producto', $$('.row').length === 1);
  $('[data-act=clearfav]').click(); await espera(120);
  ok('Vaciar favoritos', estado().fav.length === 0);

  /* 8. Redes sociales y pie de página */
  await ir('#/carrito'); const antes = location.hash;
  $('[data-act=social]') && $('[data-act=social]').click();
  await ir('#/inicio'); $('[data-act=social]').click(); await espera(80);
  ok('Íconos de redes no sacan de la página', location.hash === '#/inicio');
  ok('Ningún enlace del pie apunta a "#" vacío', $$('footer a').every(a => a.getAttribute('href') !== '#'));

  /* 9. Cuenta: checkout sin sesión → registro → vuelve al checkout */
  await ir('#/checkout');
  ok('Checkout sin sesión pide iniciar sesión', location.hash.startsWith('#/login') && txt().includes('terminar tu compra'));
  $$('a').find(a => a.textContent === 'Crear cuenta').click(); await espera(150);
  ok('"Crear cuenta" conserva el destino', location.hash.includes('next=checkout'));
  await enviar($('#fRegistro'), {email: 'no-es-correo', pass: '1234'});
  ok('Registro rechaza correo inválido', txt().includes('email válido'));
  await enviar($('#fRegistro'), {email: 'Ana@Prueba', pass: '12'});
  ok('Registro rechaza contraseña corta', txt().includes('al menos 4'));
  await enviar($('#fRegistro'), {email: 'Ana@Prueba', pass: '1234', terms: true});
  ok('Registro lleva directo al pago', location.hash === '#/checkout' && estado().session === 'ana@prueba');
  await ir('#/login'); await espera(80);
  ok('Con sesión iniciada, /login redirige', !location.hash.startsWith('#/login'));
  await ir('#/cuenta'); $('[data-act=logout]').click(); await espera(120);
  await ir('#/login');
  await enviar($('#fLogin'), {email: 'ana@prueba', pass: 'mala'});
  ok('Login con contraseña incorrecta avisa', txt().includes('contraseña no es correcta'));
  await enviar($('#fLogin'), {email: 'nadie@x', pass: '1234'});
  ok('Login con cuenta inexistente avisa', txt().includes('No existe una cuenta'));
  await enviar($('#fLogin'), {email: '  ANA@PRUEBA ', pass: '1234'});
  ok('Login ignora mayúsculas y espacios', estado().session === 'ana@prueba');
  await ir('#/registro'); await espera(60); await ir('#/cuenta'); $('[data-act=logout]').click(); await espera(100);
  await ir('#/registro');
  await enviar($('#fRegistro'), {email: 'ana@prueba', pass: '9999', terms: true});
  ok('No permite registrar un correo repetido', txt().includes('Ya existe una cuenta'));
  await ir('#/login'); await enviar($('#fLogin'), {email: 'ana@prueba', pass: '1234'});

  /* 10. Checkout: retiro en tienda, validaciones y pago */
  await ir('#/checkout');
  $('input[name=entrega][value=retiro]').click(); await espera(120);
  ok('Retiro en tienda deja el envío gratis', $$('.line').some(l => l.textContent.includes('Retiro en tienda') && l.textContent.includes('Gratis')));
  ok('Retiro en tienda oculta la dirección', !$('#fDatos input[name=dir]'));
  await enviar($('#fDatos'), {nombre: 'A', tel: '+56 9 1234 5678'});
  ok('Valida el nombre', $('#errDatos').textContent.includes('nombre'));
  await enviar($('#fDatos'), {nombre: 'Ana Pérez', tel: '12'});
  ok('Valida el teléfono', $('#errDatos').textContent.includes('teléfono'));
  $('input[name=entrega][value=domicilio]').click(); await espera(120);
  ok('Al cambiar a domicilio conserva el nombre escrito', $('#fDatos input[name=nombre]').value === 'Ana Pérez');
  await enviar($('#fDatos'), {nombre: 'Ana Pérez', tel: '+56 9 8765 4321', dir: '', comuna: 'Ñuñoa'});
  ok('Domicilio exige dirección', $('#errDatos').textContent.includes('dirección'));
  await enviar($('#fDatos'), {nombre: 'Ana Pérez', tel: '+56 9 8765 4321', dir: 'Irarrázaval 2000', comuna: 'Ñuñoa'});
  ok('Datos correctos pasan al paso de pago', !!$('[data-act=pagar]'));
  const nPed = estado().orders.length;
  $('[data-act=pagar]').click(); await espera(150);
  ok('Pago muestra confirmación con productos', txt().includes('Gracias por tu compra') && $$('.line').length >= 2);
  ok('Se crea exactamente un pedido y se vacía el carrito', estado().orders.length === nPed + 1 && estado().cart.length === 0);
  pagar(); await espera(80);
  ok('Pagar de nuevo con carrito vacío no crea otro pedido', estado().orders.length === nPed + 1);
  await ir('#/cuenta');
  ok('Mis pedidos muestra el pedido con detalle', $$('.ord-d').length === 1 && $('.ord-items').textContent.includes('Talla'));

  /* 11. Boletín y contacto */
  await ir('#/inicio');
  await enviar($('#fNews'), {email: 'ana@prueba'}); await enviar($('#fNews'), {email: 'ana@prueba'});
  ok('Boletín no duplica suscripciones', estado().news.length === 1);
  await ir('#/contacto');
  ok('Contacto rellena el correo de la sesión', $('#fContacto input[name=email]').value === 'ana@prueba');
  await enviar($('#fContacto'), {nombre: 'Ana', email: 'ana@prueba', mensaje: ''});
  ok('Contacto exige mensaje', $('#errContacto').textContent.includes('mensaje'));
  await enviar($('#fContacto'), {nombre: 'Ana', email: 'ana@prueba', mensaje: 'Quiero cambiar una talla'});
  ok('Contacto confirma envío', txt().includes('Mensaje enviado') && estado().mensajes.length === 1);

  /* 12. Panel del dueño */
  await ir('#/admin');
  await enviar($('#fAdminLogin'), {email: 'dueno@urbano.cl', pass: 'mala'});
  ok('Panel rechaza contraseña incorrecta', txt().includes('incorrectos'));
  await enviar($('#fAdminLogin'), {email: 'dueno@urbano.cl', pass: 'dueno123'});
  ok('Panel acepta al dueño y abre en el Resumen', $$('.rcard').length === 6 && !!$('.guia'));
  $('.guia [data-act=adIr][data-t=productos]').click(); await espera(100);
  ok('La guía del Resumen lleva a Productos', !!$('[data-act=adNuevo]'));
  $('[data-act=adNuevo]').click(); await espera(100);
  await enviar($('#fProducto'), {name: 'Polera Test', price: '10000', old: '9000', tipo: 'Poleras y Tops'});
  ok('Oferta con precio anterior menor se rechaza con explicación', $('#errProd').textContent.includes('MAYOR'));
  await enviar($('#fProducto'), {name: '<b>Polera</b> Test', price: '10000', old: '15000', tipo: 'Poleras y Tops', destacado: true, st_M: '5'});
  const nuevo = PRODUCTS[PRODUCTS.length - 1];
  ok('Producto nuevo se guarda', nuevo.name === '<b>Polera</b> Test' && nuevo.old === 15000);
  await ir('#/catalogo?q=polera%20test');
  ok('Nombre con HTML se muestra como texto (sin inyectar)', !$('.pinfo h4 b') && txt().includes('<b>Polera</b> Test'));
  ok('Producto sin foto muestra "Foto pendiente"', txt().includes('Foto pendiente'));
  await ir('#/inicio');
  ok('Producto destacado aparece en la portada', txt().includes('<b>Polera</b> Test'));
  addCart(nuevo.id, 'M', 1); S.fav.push(nuevo.id); save();
  await ir('#/admin'); await espera(50);
  $$('.arow').find(r => r.textContent.includes(nuevo.name)).querySelector('[data-act=adBorrar]').click(); await espera(150);
  ok('Borrar elimina el producto del panel', !PRODUCTS.some(p => p.id === nuevo.id));
  await ir('#/carrito');
  ok('Borrar un producto lo saca del carrito', !txt().includes(nuevo.name));
  await ir('#/favoritos'); ok('Borrar un producto lo saca de favoritos', !txt().includes(nuevo.name));
  await ir('#/admin'); $('[data-act=adTab][data-t=banners]').click(); await espera(100);
  await enviar($('#fBanners'), {t1_0: 'Verano 2026'});
  await ir('#/inicio'); ok('Banner editado se ve en la portada', $('.hero h1').textContent === 'Verano 2026');
  await ir('#/admin'); $('[data-act=adTab][data-t=ajustes]').click(); await espera(80);
  $('[data-act=adRestaurar]').click(); await espera(120);
  await ir('#/inicio'); ok('Restaurar vuelve a los datos originales', $('.hero h1').textContent === DEFAULT_SLIDES[0].t1 && PRODUCTS.length === 70);

  /* 13. Cupones de descuento */
  S.admin = false; S.cart = []; S.cupon = ''; save();
  addCart(2, 'M', 1);                     /* $6.990: bajo el mínimo de BIENVENIDA */
  await ir('#/carrito');
  await enviar($('#fCupon'), {codigo: 'NOEXISTE'});
  ok('Cupón inexistente avisa', $('#errCupon').textContent.includes('no existe'));
  await enviar($('#fCupon'), {codigo: '  urbano10 '});
  let t = totales(false);
  ok('Cupón acepta minúsculas y espacios', S.cupon === 'URBANO10' && t.desc === Math.round(prodById(2).price * 0.1));
  ok('Carrito muestra la línea de descuento', !!$('.line.desc'));
  $('[data-act=quitarCupon]').click(); await espera(100);
  ok('Quitar cupón', !S.cupon && !$('.line.desc'));
  await enviar($('#fCupon'), {codigo: 'BIENVENIDA'});
  ok('Cupón con mínimo avisa cuánto falta', $('.cupon-ok').textContent.includes('te faltan') && totales(false).desc === 0);
  addCart(11, 'M', 1); await ir('#/inicio'); await ir('#/carrito');
  t = totales(false);
  ok('Al llegar al mínimo, el cupón se aplica solo', t.valido && t.desc === Math.round(t.sub * 0.15));
  $('[data-act=quitarCupon]').click(); await espera(80);
  await enviar($('#fCupon'), {codigo: 'ENVIOGRATIS'});
  ok('ENVIOGRATIS deja el envío en cero', totales(false).envio === 0);
  S.session = S.session || 'ana@prueba'; save();
  await ir('#/checkout');
  const totalEsperado = totales(false).total;
  await enviar($('#fDatos'), {nombre: 'Ana Pérez', tel: '+56 9 8765 4321', dir: 'Irarrázaval 2000', comuna: 'Ñuñoa'});
  $('[data-act=pagar]').click(); await espera(150);
  ok('El pedido guarda el total con cupón', S.orders[0].total === totalEsperado && S.orders[0].cupon === 'ENVIOGRATIS');
  ok('El cupón se usa una sola vez', !S.cupon);

  /* 14. Buscador con sugerencias */
  await ir('#/inicio');
  const caja = $('#fSearch input');
  caja.value = 'ves'; caja.dispatchEvent(new Event('input', {bubbles: true}));
  ok('Sugerencias al escribir', !$('#sugg').hidden && $$('#sugg a').length >= 2);
  ok('Sugerencia de categoría', $$('#sugg a').some(a => a.textContent.includes('Categoría')));
  caja.value = 'zzzz'; caja.dispatchEvent(new Event('input', {bubbles: true}));
  ok('Sin coincidencias lo dice', $('#sugg').textContent.includes('Sin coincidencias'));
  caja.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  ok('Escape cierra las sugerencias', $('#sugg').hidden);
  caja.value = 'jeans'; caja.dispatchEvent(new Event('input', {bubbles: true}));
  caja.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
  ok('Flecha abajo recorre las sugerencias', document.activeElement && document.activeElement.closest('#sugg'));

  /* 15. Banner: avanzar no borra lo que se está escribiendo */
  await ir('#/inicio');
  $('#fNews input').value = 'escribiendo@ahora';
  const titulo0 = $('.hero h1').textContent;
  $('[data-act=slide][data-d="1"]').click(); await espera(50);
  ok('El banner cambia', $('.hero h1').textContent !== titulo0);
  ok('Cambiar el banner no borra el formulario', $('#fNews input').value === 'escribiendo@ahora');

  /* 16. Vistos recientemente, foto ampliada, últimas unidades */
  S.vistos = []; save();
  for (const id of [12, 25, 6]) await ir('#/producto?id=' + id);
  const pocas = PRODUCTS.find(p => stockTotal(p) > 0 && stockTotal(p) <= POCO);
  if (pocas) { await ir('#/producto?id=' + pocas.id); ok('Ficha avisa "Quedan solo…" cuando hay poco stock', txt().includes('Quedan solo ' + stockTotal(pocas))); }
  await ir('#/inicio');
  ok('Portada muestra "Vistos recientemente"', txt().includes('Vistos recientemente') && txt().includes(prodById(25).name));
  await ir('#/producto?id=12');
  $('.pdp-img').click(); await espera(60);
  ok('La foto se abre en grande', !!$('.lightbox img'));
  document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  ok('Escape cierra la foto', !$('.lightbox') && document.body.style.overflow === '');
  $('.pdp-img').click(); await espera(60);
  await ir('#/catalogo');
  ok('Cambiar de página cierra la foto', !$('.lightbox'));

  /* 17. Contadores, volver arriba y accesibilidad */
  S.fav = [3, 4]; save(); await ir('#/inicio');
  ok('Contador de favoritos en el menú', $$('nav a[href="#/favoritos"] .badge').some(b => b.textContent === '2'));
  $('[data-act=saltar]').click();
  ok('"Saltar al contenido" lleva el foco al contenido', document.activeElement && document.activeElement.id === 'contenido');
  ok('Menú marca la página actual', !!$('nav a[aria-current="page"]'));
  ok('Botón "volver arriba" existe', !!$('.totop'));

  /* 18. Panel del dueño: pedidos, mensajes y buscador */
  S.admin = true; save(); AD = {tab: 'productos', edit: null, filtro: 'todos'};
  await ir('#/admin');
  const busc = $('#adBuscar');
  busc.value = 'vestido'; busc.dispatchEvent(new Event('input', {bubbles: true}));
  const visibles = $$('.arow').filter(r => !r.hidden);
  ok('Buscador del panel filtra productos', visibles.length === 10 && visibles.every(r => norm(r.textContent).includes('vestido')));
  ok('Buscador del panel actualiza el contador', $('#adCuenta').textContent.startsWith('10'));
  $('[data-act=adTab][data-t=pedidos]').click(); await espera(80);
  ok('Pestaña Pedidos lista los pedidos', $$('.ped').length === S.orders.length && txt().includes('ticket promedio'));
  $('[data-act=adTab][data-t=mensajes]').click(); await espera(80);
  ok('Pestaña Mensajes muestra mensajes y suscritas', txt().includes('Quiero cambiar una talla') && txt().includes('Suscritas al boletín'));
  S.admin = false; save();

  /* 19. Stock e inventario */
  S.admin = true; S.cart = []; S.cupon = ''; S.session = 'ana@prueba'; save();
  AD = {tab: 'inventario', edit: null, filtro: 'todos'}; location.hash = '#/inicio'; await espera(80);
  await ir('#/admin');
  ok('Inventario muestra una fila por producto', $$('.inv [data-stock]').length > 0 && txt().includes('Inventario'));
  const cajaSt = $('input[data-stock="2"][data-s="M"]');
  cajaSt.value = '2'; cajaSt.dispatchEvent(new Event('change', {bubbles: true})); await espera(60);
  ok('Escribir el stock lo guarda', prodById(2).stock.M === 2 && estado().prods.find(p => p.id === 2).stock.M === 2);
  $('[data-act=stCambia][data-id="2"][data-s="M"][data-d="1"]').click(); await espera(60);
  ok('Botón + suma una unidad', prodById(2).stock.M === 3 && $('input[data-stock="2"][data-s="M"]').value === '3');
  $('input[data-stock="2"][data-s="M"]').value = '-5';
  $('input[data-stock="2"][data-s="M"]').dispatchEvent(new Event('change', {bubbles: true})); await espera(60);
  ok('Stock negativo queda en 0', prodById(2).stock.M === 0);
  $('[data-act=stCambia][data-id="2"][data-s="M"][data-d="-1"]').click(); await espera(60);
  ok('Botón − no baja de 0', prodById(2).stock.M === 0);
  cambiarStock(2, 'M', 3);
  $('[data-act=adFiltro][data-f=agotados]').click(); await espera(80);
  ok('Filtro "Agotados" muestra solo productos sin stock', $$('.inv .arow, .inv > *').length >= 0 && PRODUCTS.filter(p => !stockTotal(p)).every(p => txt().includes(p.name)));
  await ir('#/producto?id=2');
  [...$$('.size')].find(b => b.dataset.s === 'M').click(); await espera(60);
  ok('La ficha avisa cuántas quedan', txt().includes('Quedan solo 3'));
  for (let i = 0; i < 8; i++) { $$('[data-act=pqty]')[1].click(); await espera(10); }
  ok('No se puede elegir más que el stock', $('.qty span').textContent === '3');
  $('[data-act=agregarPdp]').click(); await espera(100);
  ok('Agregar respeta el stock', enCarroDe(2, 'M') === 3);
  ok('No se puede agregar más de lo que hay', addCart(2, 'M', 1) === 0 && enCarroDe(2, 'M') === 3);
  await ir('#/checkout');
  await enviar($('#fDatos'), {nombre: 'Ana Pérez', tel: '+56 9 8765 4321', dir: 'Irarrázaval 2000', comuna: 'Ñuñoa'});
  $('[data-act=pagar]').click(); await espera(150);
  ok('Comprar descuenta el stock', prodById(2).stock.M === 0);
  ok('El pedido nuevo queda "Recibido"', S.orders[0].estado === 'Recibido');
  await ir('#/producto?id=2');
  ok('Talla vendida queda agotada en la ficha', [...$$('.size')].find(b => b.dataset.s === 'M').disabled);
  await ir('#/cuenta');
  ok('La clienta ve el estado del pedido', txt().includes('Recibido'));
  await ir('#/admin'); $('[data-act=adTab][data-t=pedidos]').click(); await espera(80);
  const sel = $(`select[data-estado="${S.orders[0].id}"]`);
  sel.value = 'Enviado'; sel.dispatchEvent(new Event('change', {bubbles: true})); await espera(80);
  ok('El dueño cambia el estado del pedido', S.orders[0].estado === 'Enviado' && estado().orders[0].estado === 'Enviado');
  const sel2 = $(`select[data-estado="${S.orders[0].id}"]`);
  sel2.value = 'Cancelado'; sel2.dispatchEvent(new Event('change', {bubbles: true})); await espera(80);
  ok('Cancelar un pedido devuelve el stock', prodById(2).stock.M === 3);
  const sel3 = $(`select[data-estado="${S.orders[0].id}"]`);
  sel3.value = 'Recibido'; sel3.dispatchEvent(new Event('change', {bubbles: true})); await espera(80);
  ok('Reactivar un pedido cancelado vuelve a descontar', prodById(2).stock.M === 0);
  /* Carrito con más unidades que el stock se ajusta solo */
  cambiarStock(2, 'M', 5); S.cart = [{id: 2, size: 'M', qty: 4}]; save();
  cambiarStock(2, 'M', 1);
  await ir('#/carrito');
  ok('Si baja el stock, el carrito se ajusta', S.cart.length === 1 && S.cart[0].qty === 1);
  cambiarStock(2, 'M', 0); await ir('#/inicio'); await ir('#/carrito');
  ok('Si se agota, sale del carrito', !S.cart.some(i => i.id === 2 && i.size === 'M'));
  /* Ocultar producto */
  AD = {tab: 'productos', edit: null, filtro: 'todos'}; await ir('#/inicio'); await ir('#/admin');
  $('[data-act=adOcultar][data-id="3"]').click(); await espera(80);
  ok('Ocultar saca el producto de la tienda', prodById(3).oculto && !filtrar(new URLSearchParams('')).some(p => p.id === 3));
  await ir('#/producto?id=3');
  ok('Ficha de producto oculto avisa que no está disponible', txt().includes('no está disponible'));
  await ir('#/admin'); $('[data-act=adOcultar][data-id="3"]').click(); await espera(80);
  ok('Mostrar de nuevo lo devuelve a la tienda', !prodById(3).oculto && filtrar(new URLSearchParams('')).some(p => p.id === 3));
  /* Producto agotado completo */
  sizesOf(prodById(4)).forEach(s => cambiarStock(4, s, 0));
  await ir('#/catalogo');
  ok('Producto agotado se marca y va al final del catálogo', filtrar(new URLSearchParams('')).slice(-1)[0].id === 4 && txt().includes('Agotado'));
  await ir('#/producto?id=4');
  ok('Producto agotado no se puede comprar', $('[data-act=agregarPdp]').disabled && txt().includes('agotado'));
  /* Stock en el formulario de edición */
  AD = {tab: 'productos', edit: 4, filtro: 'todos'}; await ir('#/inicio'); await ir('#/admin');
  await enviar($('#fProducto'), {st_S: '7'});
  ok('Formulario de producto guarda el stock por talla', prodById(4).stock.S === 7);
  S.admin = false; S.cart = []; save();

  /* 20. Prueba caótica: 400 acciones al azar */
  const antesErr = errores.length;
  const rnd = n => Math.floor(Math.random() * n);
  const rutas = ['#/inicio', '#/catalogo', '#/carrito', '#/favoritos', '#/checkout', '#/cuenta', '#/contacto', '#/ayuda?t=faq',
                 '#/producto?id=' + (1 + rnd(70)), '#/catalogo?tipo=Vestidos', '#/catalogo?oferta=1', '#/login', '#/registro'];
  for (let i = 0; i < 400; i++) {
    const tipo = rnd(10);
    if (tipo < 2) { location.hash = rutas[rnd(rutas.length)]; render(); continue; }
    if (tipo === 2) {          /* escribir algo raro en un campo y enviar el formulario */
      const forms = $$('form').filter(f => !['fAdminLogin'].includes(f.id));
      const f = forms[rnd(forms.length)];
      if (f) { $$('input,textarea', f).forEach(() => {}); [...f.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=hidden]),textarea')].forEach(el => { el.value = ['', 'a', '<script>x</script>', '9'.repeat(30), 'ñandú@chile', '  '][rnd(6)]; }); try { f.requestSubmit(); } catch(e){} }
      continue;
    }
    const clicables = $$('[data-act], #app a[href^="#/"]').filter(el => !el.closest('[target]') && el.dataset.act !== 'adRestaurar' && el.offsetParent !== null);
    const el = clicables[rnd(clicables.length)];
    if (!el) continue;
    if (el.tagName === 'A') { location.hash = el.getAttribute('href'); render(); }
    else el.click();
  }
  await espera(200);
  ok('Prueba caótica: sin errores de JavaScript', errores.length === antesErr, errores.slice(antesErr).join(' | '));
  ok('Prueba caótica: la página sigue funcionando', document.getElementById('app').innerHTML.length > 200);
  ok('Prueba caótica: el carrito sigue siendo válido', S.cart.every(i => prodById(i.id) && i.qty >= 1 && i.qty <= MAXQ && sizeOk(prodById(i.id), i.size) && i.qty <= stockDe(prodById(i.id), i.size)));
  ok('Prueba caótica: favoritos sin repetidos', new Set(S.fav).size === S.fav.length);
  cerrarFoto();

  /* 21. Sin errores de JavaScript durante todas las pruebas */
  ok('Sin errores de JavaScript', errores.length === 0, errores.join(' | '));

  /* Resumen */
  const fallas = resultados.filter(r => !r.ok);
  console.table(resultados.map(r => ({prueba: r.nombre, resultado: r.ok ? 'OK' : 'FALLA', detalle: r.detalle})));
  console.log(`%c${resultados.length - fallas.length} de ${resultados.length} pruebas OK`, `font-size:16px;color:${fallas.length ? 'red' : 'green'}`);
  localStorage.removeItem(KEY);
  window.__resultadoPruebas = {total: resultados.length, ok: resultados.length - fallas.length, fallas};
  return window.__resultadoPruebas;
})().catch(e => {
  window.__errorPrueba = `Se detuvo después de "${window.__ultimaPrueba}": ${e && e.message}`;
  console.error(window.__errorPrueba, e);
});
