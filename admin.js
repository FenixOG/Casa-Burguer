// ==========================================
// 1. MANEJO DE SESIÓN Y AUTENTICACIÓN
// ==========================================
const loginForm = document.getElementById('login-form');
const adminPanel = document.getElementById('admin-panel');
const loginContainer = document.getElementById('login-container');

auth.onAuthStateChanged(user => {
    if (user) {
        if(loginContainer) loginContainer.classList.add('hidden');
        if(adminPanel) adminPanel.classList.remove('hidden');
        document.getElementById('admin-user-email').innerText = user.email;
        initAdminDashboard();
    } else {
        if(loginContainer) loginContainer.classList.remove('hidden');
        if(adminPanel) adminPanel.classList.add('hidden');
    }
});

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, pass).catch(err => {
            document.getElementById('login-error').innerText = "Credenciales incorrectas de Administrador.";
        });
    });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) { btnLogout.addEventListener('click', () => auth.signOut()); }

// ==========================================
// 2. SISTEMA DE ROUTER INTERNO (TABS DEL PANEL)
// ==========================================
const navItems = document.querySelectorAll('.nav-item:not(.logout)');
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const target = item.getAttribute('data-target');
        document.getElementById('current-view-title').innerText = target.toUpperCase();
        
        document.querySelectorAll('.admin-view').forEach(view => view.classList.add('hidden'));
        document.getElementById(`view-${target}`).classList.remove('hidden');
    });
});

// ==========================================
// 3. INICIALIZACIÓN DE DASHBOARD, ESCUCHAS REALTIME Y ALERTAS
// ==========================================
let salesChartInstance = null;

function initAdminDashboard() {
    let rawTotalSales = 0;
    let totalPendientes = 0;
    let totalConfirmados = 0;
    let totalFacturasConfirmadas = 0;
    
    // Alerta de sonido inteligente e incremental para nuevos pedidos
    let primerCarga = true;
    db.collection('pedidos').onSnapshot(snapshot => {
        totalPendientes = 0;
        totalConfirmados = 0;
        const tableBody = document.getElementById('table-pedidos-body');
        if(tableBody) tableBody.innerHTML = '';

        snapshot.forEach(doc => {
            const ped = doc.data();
            if (ped.estado === 'Pendiente') totalPendientes++;
            if (ped.estado === 'Confirmado' || ped.estado === 'Entregado') totalConfirmados++;

            if(tableBody) {
                tableBody.innerHTML += `
                    <tr>
                        <td>${ped.cliente}</td>
                        <td>${ped.telefono}</td>
                        <td>${ped.direccion}</td>
                        <td>$${ped.total}</td>
                        <td><span class="badge" style="background:#555;">${ped.pago}</span></td>
                        <td><strong style="color:${ped.estado==='Pendiente'?'orange':'green'}">${ped.estado}</strong></td>
                        <td>
                            ${ped.estado==='Pendiente'? `<button class="btn-primary" style="padding:4px 8px; font-size:0.8rem;" onclick="cambiarEstadoPedido('${doc.id}', 'Confirmado')">Confirmar</button>` : ''}
                            ${ped.estado==='Confirmado'? `<button class="btn-primary" style="padding:4px 8px; font-size:0.8rem; background:green; color:#fff" onclick="cambiarEstadoPedido('${doc.id}', 'Entregado')">Entregar</button>` : ''}
                        </td>
                    </tr>
                `;
            }
        });

        document.getElementById('stat-pendientes').innerText = totalPendientes;
        document.getElementById('stat-confirmados').innerText = totalConfirmados;
        document.getElementById('badge-pedidos').innerText = totalPendientes;

        // Si hay un nuevo pedido y no es la carga inicial del panel, suena la alerta en cocina
        if(!primerCarga && totalPendientes > 0) {
            document.getElementById('alert-sound').play().catch(e=>console.log("Audio esperando interacción"));
        }
        primerCarga = false;
    });

    // Escucha de facturas e ingresos globales
    db.collection('facturas').onSnapshot(snapshot => {
        rawTotalSales = 0;
        totalFacturasConfirmadas = 0;
        const tableFacturas = document.getElementById('table-facturas-body');
        if(tableFacturas) tableFacturas.innerHTML = '';

        snapshot.forEach(doc => {
            const fact = doc.data();
            if(fact.estado === 'Confirmada') {
                rawTotalSales += fact.total;
                totalFacturasConfirmadas++;
            }
            if(tableFacturas) {
                tableFacturas.innerHTML += `
                    <tr>
                        <td>${doc.id.substring(0,6)}...</td>
                        <td>${fact.cliente}</td>
                        <td>Factura CasaBurguer</td>
                        <td>$${fact.subtotal.toFixed(0)}</td>
                        <td>$${fact.total}</td>
                        <td>
                            <select onchange="cambiarEstadoFactura('${doc.id}', this.value)" style="padding:4px; border-radius:5px;">
                                <option value="Pendiente" ${fact.estado==='Pendiente'?'selected':''}>Pendiente</option>
                                <option value="Confirmada" ${fact.estado==='Confirmada'?'selected':''}>Confirmada</option>
                            </select>
                        </td>
                    </tr>
                `;
            }
        });
        document.getElementById('stat-ventas').innerText = `$${rawTotalSales}`;
        document.getElementById('stat-facturas').innerText = totalFacturasConfirmadas;
        
        // Almacenar automáticamente en ventas e historial para analíticas
        renderGraficaAnalitica(rawTotalSales);
    });

    // Cargar Catálogo CRUD Productos
    cargarProductosCRUD();
}

window.cambiarEstadoPedido = function(id, nuevoEstado) {
    db.collection('pedidos').doc(id).update({ estado: nuevoEstado });
};

window.cambiarEstadoFactura = function(id, nuevoEstado) {
    db.collection('facturas').doc(id).update({ estado: nuevoEstado }).then(() => {
        // Al confirmar factura, registrar directamente en el historial de ventas consolidado
        if(nuevoEstado === 'Confirmada') {
            db.collection('facturas').doc(id).get().then(doc => {
                const f = doc.data();
                db.collection('ventas').add({
                    fecha: new Date().toISOString().split('T')[0],
                    monto: f.total,
                    idFactura: id,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        }
    });
};

// ==========================================
// 4. CRUD DE PRODUCTOS E INTEGRACIÓN CON STORAGE
// ==========================================
const productForm = document.getElementById('product-form');
const prodModal = document.getElementById('product-modal');

if(document.getElementById('btn-open-prod-modal')) {
    document.getElementById('btn-open-prod-modal').addEventListener('click', () => {
        productForm.reset();
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-modal-title').innerText = "Agregar Nuevo Producto";
        prodModal.style.display = 'flex';
    });
}
if(document.getElementById('close-prod-modal')) {
    document.getElementById('close-prod-modal').addEventListener('click', () => prodModal.style.display = 'none');
}

function cargarProductosCRUD() {
    db.collection('productos').onSnapshot(snapshot => {
        const tableBody = document.getElementById('table-productos-body');
        if(!tableBody) return;
        tableBody.innerHTML = '';
        snapshot.forEach(doc => {
            const p = doc.data();
            tableBody.innerHTML += `
                <tr>
                    <td><img src="${p.imageUrl || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; object-fit:cover; border-radius:5px;"></td>
                    <td>${p.name}</td>
                    <td>${p.category}</td>
                    <td>$${p.price}</td>
                    <td>${p.stock}</td>
                    <td>${p.available ? 'Activo' : 'Pausado'}</td>
                    <td>
                        <button onclick="editarProdModal('${doc.id}', '${p.name}', '${p.category}', ${p.price}, ${p.stock}, ${p.available})" class="btn-filter" style="padding:4px 8px;"><i class="fas fa-edit"></i></button>
                        <button onclick="eliminarProd('${doc.id}')" class="btn-icon" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

window.editarProdModal = function(id, name, cat, price, stock, avail) {
    document.getElementById('prod-id').value = id;
    document.getElementById('prod-name').value = name;
    document.getElementById('prod-category').value = cat;
    document.getElementById('prod-price').value = price;
    document.getElementById('prod-stock').value = stock;
    document.getElementById('prod-available').checked = (avail === 'true' || avail === true);
    document.getElementById('prod-modal-title').innerText = "Editar Producto";
    prodModal.style.display = 'flex';
};

window.eliminarProd = function(id) {
    if(confirm("¿Eliminar este delicioso producto del menú?")) { db.collection('productos').doc(id).delete(); }
};

if(productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const category = document.getElementById('prod-category').value;
        const price = parseFloat(document.getElementById('prod-price').value);
        const stock = parseInt(document.getElementById('prod-stock').value);
        const available = document.getElementById('prod-available').checked;
        const file = document.getElementById('prod-image-file').files[0];
        
        let imageUrl = "";

        // Subida de imagen a Firebase Storage en caso de adjuntar un archivo
        if(file && firebase.storage) {
            const storageRef = firebase.storage().ref(`productos/${Date.now()}_${file.name}`);
            const uploadTask = await storageRef.put(file);
            imageUrl = await uploadTask.ref.getDownloadURL();
        }

        const payload = { name, category, price, stock, available };
        if(imageUrl) payload.imageUrl = imageUrl;

        if(id) {
            await db.collection('productos').doc(id).update(payload);
        } else {
            await db.collection('productos').add(payload);
        }
        prodModal.style.display = 'none';
        productForm.reset();
    });
}

// ==========================================
// 5. CONTROL DE GRÁFICAS ESTADÍSTICAS (CHART.JS)
// ==========================================
function renderGraficaAnalitica(ventasTotales) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    if(salesChartInstance) salesChartInstance.destroy();

    salesChartInstance = new Chart(ctx, {
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
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}