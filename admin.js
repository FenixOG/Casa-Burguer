// ==========================================
// PANEL ADMIN - LÓGICA DE SESIÓN, CRUD Y MÉTRICAS
// Correcciones funcionales sin cambios visuales.
// ==========================================

const loginForm = document.getElementById('login-form');
const adminPanel = document.getElementById('admin-panel');
const loginContainer = document.getElementById('login-container');
const btnLogout = document.getElementById('btn-logout');
const navItems = Array.from(document.querySelectorAll('.nav-item[data-target]'));
const productForm = document.getElementById('product-form');
const prodModal = document.getElementById('product-modal');
const productModalTitle = document.getElementById('prod-modal-title');
const currentViewTitle = document.getElementById('current-view-title');
const alertSound = document.getElementById('alert-sound');
const filterDateInput = document.getElementById('filter-date-input');
const btnClearFilter = document.getElementById('btn-clear-filter');

const adminState = {
    initialized: false,
    filtersBound: false,
    unsubscribers: [],
    salesChartInstance: null,
    currentProductImageUrl: '',
    ventasCache: []
};

function addUnsubscribe(unsubscribe) {
    if (typeof unsubscribe === 'function') {
        adminState.unsubscribers.push(unsubscribe);
    }
}

function clearAdminSubscriptions() {
    while (adminState.unsubscribers.length) {
        const unsubscribe = adminState.unsubscribers.pop();
        try {
            unsubscribe();
        } catch (error) {
            console.warn('No se pudo cerrar una suscripción del admin:', error);
        }
    }
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    return `$${amount.toLocaleString('es-CO')}`;
}

function formatDateTime(value) {
    if (!value) return '—';
    if (typeof value === 'string') return value;
    if (value.toDate) return value.toDate().toLocaleString('es-CO');
    return '—';
}

function setActiveView(target) {
    navItems.forEach(item => item.classList.toggle('active', item.dataset.target === target));
    document.querySelectorAll('.admin-view').forEach(view => view.classList.add('hidden'));

    const targetView = document.getElementById(`view-${target}`);
    if (targetView) targetView.classList.remove('hidden');

    const viewTitles = {
        dashboard: 'Dashboard',
        pedidos: 'Pedidos',
        productos: 'Productos',
        facturas: 'Facturas',
        ventas: 'Ventas'
    };

    if (currentViewTitle) {
        currentViewTitle.innerText = viewTitles[target] || target.toUpperCase();
    }
}

function playAlertSound() {
    if (!alertSound) return;
    alertSound.play().catch(() => console.log('Audio esperando interacción'));
}

function getStorageService() {
    if (typeof firebase === 'undefined' || typeof firebase.storage !== 'function') {
        return null;
    }
    return firebase.storage();
}

function resetProductModal() {
    if (productForm) productForm.reset();
    const prodId = document.getElementById('prod-id');
    if (prodId) prodId.value = '';
    adminState.currentProductImageUrl = '';
    if (productModalTitle) productModalTitle.innerText = 'Agregar Nuevo Producto';
}

function closeProductModal() {
    if (prodModal) prodModal.style.display = 'none';
}

function openProductModal() {
    if (prodModal) prodModal.style.display = 'flex';
}

function createActionButton(label, className, iconClass, onClick, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.title = title || label;

    if (iconClass) {
        const icon = document.createElement('i');
        icon.className = iconClass;
        button.appendChild(icon);
    } else {
        button.textContent = label;
    }

    button.addEventListener('click', onClick);
    return button;
}

function createTableCell(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}

function renderPedidosTable(pedidos) {
    const tableBody = document.getElementById('table-pedidos-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    let pendientes = 0;
    let confirmados = 0;

    let shouldPlayAlert = false;
    const snapshotChanges = pedidos._changes || [];

    pedidos.forEach((doc) => {
        const ped = doc.data();
        const estado = ped.estado || 'Pendiente';
        if (estado === 'Pendiente') pendientes += 1;
        if (estado === 'Confirmado' || estado === 'Entregado') confirmados += 1;

        const row = document.createElement('tr');
        row.appendChild(createTableCell(ped.cliente || '—'));
        row.appendChild(createTableCell(ped.telefono || '—'));
        row.appendChild(createTableCell(ped.direccion || '—'));
        row.appendChild(createTableCell(formatMoney(ped.total)));

        const paymentCell = document.createElement('td');
        const paymentBadge = document.createElement('span');
        paymentBadge.className = 'badge';
        paymentBadge.style.background = '#555';
        paymentBadge.textContent = ped.pago || '—';
        paymentCell.appendChild(paymentBadge);
        row.appendChild(paymentCell);

        const statusCell = document.createElement('td');
        const statusStrong = document.createElement('strong');
        statusStrong.style.color = estado === 'Pendiente' ? 'orange' : 'green';
        statusStrong.textContent = estado;
        statusCell.appendChild(statusStrong);
        row.appendChild(statusCell);

        const actionsCell = document.createElement('td');

        if (estado === 'Pendiente') {
            actionsCell.appendChild(createActionButton(
                'Confirmar',
                'btn-primary',
                null,
                () => cambiarEstadoPedido(doc.id, 'Confirmado'),
                'Confirmar pedido'
            ));
        }

        if (estado === 'Confirmado') {
            const deliverButton = createActionButton(
                'Entregar',
                'btn-primary',
                null,
                () => cambiarEstadoPedido(doc.id, 'Entregado'),
                'Marcar como entregado'
            );
            deliverButton.style.padding = '4px 8px';
            deliverButton.style.fontSize = '0.8rem';
            deliverButton.style.background = 'green';
            deliverButton.style.color = '#fff';
            actionsCell.appendChild(deliverButton);
        }

        row.appendChild(actionsCell);
        tableBody.appendChild(row);
    });

    const pendientesNode = document.getElementById('stat-pendientes');
    const confirmadosNode = document.getElementById('stat-confirmados');
    const badgeNode = document.getElementById('badge-pedidos');

    if (pendientesNode) pendientesNode.innerText = pendientes;
    if (confirmadosNode) confirmadosNode.innerText = confirmados;
    if (badgeNode) badgeNode.innerText = pendientes;

    if (shouldPlayAlert) playAlertSound();
}

function renderFacturasTable(facturas) {
    const tableFacturas = document.getElementById('table-facturas-body');
    if (!tableFacturas) return;

    tableFacturas.innerHTML = '';
    let rawTotalSales = 0;
    let totalFacturasConfirmadas = 0;

    facturas.forEach((doc) => {
        const fact = doc.data();
        const subtotal = Number(fact.subtotal) || 0;
        const total = Number(fact.total) || 0;

        if (fact.estado === 'Confirmada') {
            rawTotalSales += total;
            totalFacturasConfirmadas += 1;
        }

        const row = document.createElement('tr');

        row.appendChild(createTableCell(`${doc.id.substring(0, 6)}...`));
        row.appendChild(createTableCell(fact.cliente || '—'));
        row.appendChild(createTableCell(formatDateTime(fact.fecha)));
        row.appendChild(createTableCell(formatMoney(subtotal)));
        row.appendChild(createTableCell(formatMoney(total)));

        const actionsCell = document.createElement('td');
        const statusSelect = document.createElement('select');
        statusSelect.style.padding = '4px';
        statusSelect.style.borderRadius = '5px';

        const optionPending = document.createElement('option');
        optionPending.value = 'Pendiente';
        optionPending.textContent = 'Pendiente';

        const optionConfirmed = document.createElement('option');
        optionConfirmed.value = 'Confirmada';
        optionConfirmed.textContent = 'Confirmada';

        statusSelect.appendChild(optionPending);
        statusSelect.appendChild(optionConfirmed);
        statusSelect.value = fact.estado || 'Pendiente';

        statusSelect.addEventListener('change', (event) => {
            cambiarEstadoFactura(doc.id, event.target.value);
        });

        actionsCell.appendChild(statusSelect);
        row.appendChild(actionsCell);
        tableFacturas.appendChild(row);
    });

    const ventasNode = document.getElementById('stat-ventas');
    const facturasNode = document.getElementById('stat-facturas');
    if (ventasNode) ventasNode.innerText = formatMoney(rawTotalSales);
    if (facturasNode) facturasNode.innerText = totalFacturasConfirmadas;

    renderGraficaAnalitica(rawTotalSales);
}

function renderVentasTable() {
    const tableBody = document.getElementById('table-ventas-body');
    if (!tableBody) return;

    const filterDate = filterDateInput ? filterDateInput.value : '';
    tableBody.innerHTML = '';

    const ventasFiltradas = adminState.ventasCache.filter((venta) => {
        if (!filterDate) return true;
        return String(venta.fecha || '').slice(0, 10) === filterDate;
    });

    ventasFiltradas.forEach((venta) => {
        const row = document.createElement('tr');
        row.appendChild(createTableCell(formatDateTime(venta.fechaHora || venta.timestamp)));
        row.appendChild(createTableCell(venta.idVenta || venta.idFactura || '—'));
        row.appendChild(createTableCell(formatMoney(venta.monto)));

        const detailsCell = document.createElement('td');
        const detailsParts = [];
        if (venta.idFactura) detailsParts.push(`Factura: ${venta.idFactura}`);
        if (venta.fecha) detailsParts.push(`Fecha: ${venta.fecha}`);
        detailsCell.textContent = detailsParts.length ? detailsParts.join(' | ') : '—';

        row.appendChild(detailsCell);
        tableBody.appendChild(row);
    });
}

function cargarVentasCRUD() {
    const query = db.collection('ventas').orderBy('timestamp', 'desc');
    const unsubscribe = query.onSnapshot((snapshot) => {
        adminState.ventasCache = snapshot.docs.map((doc) => {
            const venta = doc.data();
            return {
                id: doc.id,
                idVenta: venta.idVenta || doc.id,
                idFactura: venta.idFactura || '',
                fecha: venta.fecha || '',
                fechaHora: venta.fechaHora || venta.timestamp || '',
                monto: Number(venta.monto) || 0,
                timestamp: venta.timestamp || null
            };
        });

        renderVentasTable();
    }, (error) => {
        console.error('Error cargando ventas:', error);
        adminState.ventasCache = [];
        renderVentasTable();
    });

    addUnsubscribe(unsubscribe);
}

function cargarProductosCRUD() {
    const unsubscribe = db.collection('productos').onSnapshot((snapshot) => {
        const tableBody = document.getElementById('table-productos-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        snapshot.forEach((doc) => {
            const p = doc.data();
            const row = document.createElement('tr');

            const imageCell = document.createElement('td');
            const img = document.createElement('img');
            img.src = p.imageUrl || 'https://via.placeholder.com/50';
            img.alt = p.name || 'Producto';
            img.style.width = '40px';
            img.style.height = '40px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '5px';
            imageCell.appendChild(img);

            row.appendChild(imageCell);
            row.appendChild(createTableCell(p.name || '—'));
            row.appendChild(createTableCell(p.category || '—'));
            row.appendChild(createTableCell(formatMoney(p.price)));
            row.appendChild(createTableCell(String(Number(p.stock) || 0)));
            row.appendChild(createTableCell(p.available ? 'Activo' : 'Pausado'));

            const actionsCell = document.createElement('td');

            const editButton = createActionButton(
                '',
                'btn-filter',
                'fas fa-edit',
                () => editarProdModal(doc.id, p.name || '', p.category || 'burguers', Number(p.price) || 0, Number(p.stock) || 0, Boolean(p.available), p.imageUrl || ''),
                'Editar producto'
            );
            editButton.style.padding = '4px 8px';

            const deleteButton = createActionButton(
                '',
                'btn-icon',
                'fas fa-trash',
                () => eliminarProd(doc.id),
                'Eliminar producto'
            );
            deleteButton.style.color = 'var(--danger)';

            actionsCell.appendChild(editButton);
            actionsCell.appendChild(deleteButton);
            row.appendChild(actionsCell);
            tableBody.appendChild(row);
        });
    });

    addUnsubscribe(unsubscribe);
}

function cargarPedidosCRUD() {
    let firstSnapshot = true;

    const unsubscribe = db.collection('pedidos').onSnapshot((snapshot) => {
        const changes = snapshot.docChanges();
        const anyNewPending = !firstSnapshot && changes.some((change) => change.type === 'added' && (change.doc.data().estado || 'Pendiente') === 'Pendiente');

        const docs = snapshot.docs.slice();
        docs._changes = changes;
        renderPedidosTable(docs);

        if (anyNewPending) {
            playAlertSound();
        }

        firstSnapshot = false;
    }, (error) => {
        console.error('Error cargando pedidos:', error);
    });

    addUnsubscribe(unsubscribe);
}

function cargarFacturasCRUD() {
    const unsubscribe = db.collection('facturas').onSnapshot((snapshot) => {
        renderFacturasTable(snapshot.docs);
    }, (error) => {
        console.error('Error cargando facturas:', error);
    });

    addUnsubscribe(unsubscribe);
}

function renderGraficaAnalitica(ventasTotales) {
    const ctx = document.getElementById('salesChart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (adminState.salesChartInstance) {
        adminState.salesChartInstance.destroy();
    }

    adminState.salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Meta Semanal', 'Ventas Logradas'],
            datasets: [{
                label: 'Métricas de Ventas Históricas ($)',
                data: [1500000, ventasTotales],
                backgroundColor: ['#e0a800', '#28a745'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

window.cambiarEstadoPedido = async function (id, nuevoEstado) {
    try {
        await db.collection('pedidos').doc(id).update({ estado: nuevoEstado });
    } catch (error) {
        console.error('No se pudo actualizar el pedido:', error);
        alert('No fue posible actualizar el pedido.');
    }
};

window.cambiarEstadoFactura = async function (id, nuevoEstado) {
    try {
        const facturaRef = db.collection('facturas').doc(id);
        const facturaSnap = await facturaRef.get();

        if (!facturaSnap.exists) {
            alert('La factura no existe.');
            return;
        }

        const factura = facturaSnap.data();
        const estadoAnterior = factura.estado || 'Pendiente';

        await facturaRef.update({ estado: nuevoEstado });

        // Corrección clave: solo registrar una venta cuando la factura pasa de un estado distinto a "Confirmada".
        if (nuevoEstado === 'Confirmada' && estadoAnterior !== 'Confirmada') {
            const existingSale = await db.collection('ventas').where('idFactura', '==', id).limit(1).get();
            if (existingSale.empty) {
                await db.collection('ventas').add({
                    idFactura: id,
                    fecha: factura.fecha?.toDate ? factura.fecha.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    fechaHora: firebase.firestore.FieldValue.serverTimestamp(),
                    monto: Number(factura.total) || 0,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    } catch (error) {
        console.error('No se pudo actualizar la factura:', error);
        alert('No fue posible actualizar la factura.');
    }
};

window.editarProdModal = function (id, name, cat, price, stock, avail, imageUrl) {
    const prodId = document.getElementById('prod-id');
    const prodName = document.getElementById('prod-name');
    const prodCategory = document.getElementById('prod-category');
    const prodPrice = document.getElementById('prod-price');
    const prodStock = document.getElementById('prod-stock');
    const prodAvailable = document.getElementById('prod-available');
    const prodImageFile = document.getElementById('prod-image-file');

    if (prodId) prodId.value = id;
    if (prodName) prodName.value = name;
    if (prodCategory) prodCategory.value = cat;
    if (prodPrice) prodPrice.value = price;
    if (prodStock) prodStock.value = stock;
    if (prodAvailable) prodAvailable.checked = (avail === 'true' || avail === true);
    if (prodImageFile) prodImageFile.value = '';

    adminState.currentProductImageUrl = imageUrl || '';
    if (productModalTitle) productModalTitle.innerText = 'Editar Producto';
    openProductModal();
};

window.eliminarProd = async function (id) {
    if (!confirm('¿Eliminar este delicioso producto del menú?')) return;

    try {
        await db.collection('productos').doc(id).delete();
    } catch (error) {
        console.error('No se pudo eliminar el producto:', error);
        alert('No fue posible eliminar el producto.');
    }
};

function initAdminDashboard() {
    clearAdminSubscriptions();

    cargarPedidosCRUD();
    cargarFacturasCRUD();
    cargarProductosCRUD();
    cargarVentasCRUD();

    if (!adminState.filtersBound) {
        if (filterDateInput) {
            filterDateInput.addEventListener('change', renderVentasTable);
        }

        if (btnClearFilter) {
            btnClearFilter.addEventListener('click', () => {
                if (filterDateInput) filterDateInput.value = '';
                renderVentasTable();
            });
        }

        adminState.filtersBound = true;
    }

    adminState.initialized = true;
}

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const loginError = document.getElementById('login-error');

        const email = emailInput ? emailInput.value.trim() : '';
        const pass = passwordInput ? passwordInput.value : '';

        if (loginError) loginError.innerText = '';

        auth.signInWithEmailAndPassword(email, pass).catch(() => {
            if (loginError) loginError.innerText = 'Credenciales incorrectas de Administrador.';
        });
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', () => auth.signOut());
}

navItems.forEach((item) => {
    item.addEventListener('click', () => {
        setActiveView(item.dataset.target);
    });
});

if (document.getElementById('btn-open-prod-modal')) {
    document.getElementById('btn-open-prod-modal').addEventListener('click', () => {
        resetProductModal();
        openProductModal();
    });
}

if (document.getElementById('close-prod-modal')) {
    document.getElementById('close-prod-modal').addEventListener('click', closeProductModal);
}

if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('prod-id')?.value || '';
        const name = document.getElementById('prod-name')?.value.trim() || '';
        const category = document.getElementById('prod-category')?.value || 'burguers';
        const price = parseFloat(document.getElementById('prod-price')?.value || '0');
        const stock = parseInt(document.getElementById('prod-stock')?.value || '0', 10);
        const available = document.getElementById('prod-available')?.checked || false;
        const file = document.getElementById('prod-image-file')?.files?.[0] || null;

        if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
            alert('Completa correctamente los datos del producto.');
            return;
        }

        let imageUrl = adminState.currentProductImageUrl || '';
        const storageService = getStorageService();

        try {
            if (file && storageService) {
                const storageRef = storageService.ref(`productos/${Date.now()}_${file.name}`);
                const uploadResult = await storageRef.put(file);
                imageUrl = await uploadResult.ref.getDownloadURL();
            }

            const payload = {
                name,
                category,
                price,
                stock,
                available
            };

            if (imageUrl) {
                payload.imageUrl = imageUrl;
            }

            if (id) {
                await db.collection('productos').doc(id).update(payload);
            } else {
                await db.collection('productos').add(payload);
            }

            closeProductModal();
            resetProductModal();
        } catch (error) {
            console.error('No se pudo guardar el producto:', error);
            alert('No fue posible guardar el producto.');
        }
    });
}

auth.onAuthStateChanged((user) => {
    if (user) {
        if (loginContainer) loginContainer.classList.add('hidden');
        if (adminPanel) adminPanel.classList.remove('hidden');
        const adminUserEmail = document.getElementById('admin-user-email');
        if (adminUserEmail) adminUserEmail.innerText = user.email || 'admin@casaburguer.com';

        setActiveView('dashboard');
        initAdminDashboard();
    } else {
        clearAdminSubscriptions();

        if (loginContainer) loginContainer.classList.remove('hidden');
        if (adminPanel) adminPanel.classList.add('hidden');

        const loginError = document.getElementById('login-error');
        if (loginError) loginError.innerText = '';
    }
});
