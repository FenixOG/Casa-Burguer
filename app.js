// ==========================================
// 1. CONFIGURACIÓN CENTRAL DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCG0LNYBnZi5wsZfDdcmI8eeUpCo85-900",
  authDomain: "panter-studio-37981.firebaseapp.com",
  projectId: "panter-studio-37981",
  storageBucket: "panter-studio-37981.firebasestorage.app",
  messagingSenderId: "345103549312",
  appId: "1:345103549312:web:a96db21610fe820514f765",
  measurementId: "G-DP15YH6EEH"
};

// Inicializar Firebase (Verificando duplicados)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
const storage = typeof firebase.storage === 'function' ? firebase.storage() : null;

// ==========================================
// 2. LOGICA DEL MODO OSCURO
// ==========================================
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
}

// ==========================================
// 3. SISTEMA DE CARRITO DE COMPRAS (CLIENTE)
// ==========================================
let cart = JSON.parse(localStorage.getItem('casa_burguer_cart')) || [];
const productCatalogState = {
    allProducts: [],
    activeCategory: 'todos'
};

function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    const cartContainer = document.getElementById('cart-items-container');
    const cartTotalVal = document.getElementById('cart-total-val');

    if (!cartCount) return;

    cartCount.innerText = cart.reduce((acc, item) => acc + item.quantity, 0);

    if (cartContainer) {
        cartContainer.innerHTML = '';
        let total = 0;

        cart.forEach((item, index) => {
            total += item.price * item.quantity;
            cartContainer.innerHTML += `
                <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
                    <div>
                        <h4>${item.name}</h4>
                        <p class="text-muted">$${item.price} x ${item.quantity}</p>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button onclick="changeQty(${index}, -1)" class="btn-filter" style="padding:2px 8px;">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="changeQty(${index}, 1)" class="btn-filter" style="padding:2px 8px;">+</button>
                        <button onclick="removeFromCart(${index})" class="btn-icon" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });

        if (cartTotalVal) {
            cartTotalVal.innerText = `$${total}`;
        }
    }

    localStorage.setItem('casa_burguer_cart', JSON.stringify(cart));
}

window.addToCart = function(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price: parseFloat(price), quantity: 1 });
    }
    updateCartUI();
};

window.changeQty = function(index, change) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    updateCartUI();
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    updateCartUI();
};

function normalizeCategory(value) {
    return String(value || 'todos').trim().toLowerCase();
}

function getFilteredProducts() {
    if (productCatalogState.activeCategory === 'todos') {
        return productCatalogState.allProducts;
    }

    return productCatalogState.allProducts.filter((product) => normalizeCategory(product.category) === productCatalogState.activeCategory);
}

function createProductCard(docId, product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.category = normalizeCategory(product.category);

    const image = document.createElement('img');
    image.className = 'product-img';
    image.src = product.imageUrl || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=500';
    image.alt = product.name || 'Producto';
    card.appendChild(image);

    const info = document.createElement('div');
    info.className = 'product-info';

    const name = document.createElement('h3');
    name.textContent = product.name || 'Producto';
    info.appendChild(name);

    const price = document.createElement('p');
    price.className = 'product-price';
    price.textContent = `$${Number(product.price) || 0}`;
    info.appendChild(price);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-primary w-100';
    button.textContent = 'Realizar Pedido';
    button.addEventListener('click', () => window.addToCart(docId, product.name || 'Producto', Number(product.price) || 0));
    info.appendChild(button);

    card.appendChild(info);
    return card;
}

function updateCategoryButtons(activeCategory) {
    document.querySelectorAll('.categories-filter .btn-filter[data-category]').forEach((button) => {
        button.classList.toggle('active', button.dataset.category === activeCategory);
    });
}

function renderProductsCatalog() {
    if (!productsContainer) return;

    const visibleProducts = getFilteredProducts();
    productsContainer.innerHTML = '';

    if (!visibleProducts.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'loading';
        emptyMessage.textContent = productCatalogState.activeCategory === 'todos'
            ? 'No hay productos disponibles por el momento.'
            : 'No hay productos en esta categoría.';
        productsContainer.appendChild(emptyMessage);
        return;
    }

    visibleProducts.forEach((product) => {
        productsContainer.appendChild(createProductCard(product.id, product));
    });
}

function setActiveCategory(category) {
    productCatalogState.activeCategory = normalizeCategory(category);
    updateCategoryButtons(productCatalogState.activeCategory);
    renderProductsCatalog();
}

function bindCategoryFilters() {
    document.querySelectorAll('.categories-filter .btn-filter[data-category]').forEach((button) => {
        button.addEventListener('click', () => setActiveCategory(button.dataset.category));
    });

    updateCategoryButtons(productCatalogState.activeCategory);
}

const productsContainer = document.getElementById('products-container');
if (productsContainer) {
    bindCategoryFilters();

    db.collection('productos').where('available', '==', true).onSnapshot((snapshot) => {
        productCatalogState.allProducts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));

        renderProductsCatalog();
    }, (error) => {
        console.error('Error cargando productos:', error);
        productCatalogState.allProducts = [];
        renderProductsCatalog();
    });
}

// CONTROL DE MODAL CARRITO
const cartBtn = document.getElementById('cart-btn');
const cartModal = document.getElementById('cart-modal');
const closeCart = document.getElementById('close-cart');

if (cartBtn && cartModal && closeCart) {
    cartBtn.addEventListener('click', () => {
        cartModal.style.display = 'flex';
        updateCartUI();
    });

    closeCart.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });
}

// ==========================================
// 4. PROCESAMIENTO DE CHECKOUT (ENVÍO A FIRESTORE)
// ==========================================
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (cart.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        const pedidoObj = {
            cliente: document.getElementById('cust-name').value,
            telefono: document.getElementById('cust-phone').value,
            direccion: document.getElementById('cust-address').value,
            maps: document.getElementById('cust-maps').value,
            pago: document.getElementById('cust-payment').value,
            notas: document.getElementById('cust-notes').value,
            items: cart,
            total: total,
            estado: 'Pendiente',
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docRef = await db.collection('pedidos').add(pedidoObj);

            await db.collection('facturas').add({
                pedidoId: docRef.id,
                cliente: pedidoObj.cliente,
                subtotal: total * 0.81,
                total: total,
                estado: 'Pendiente',
                fecha: firebase.firestore.FieldValue.serverTimestamp()
            });

            cart = [];
            updateCartUI();
            cartModal.style.display = 'none';
            checkoutForm.reset();

            document.getElementById('qr-total-amout').innerText = `$${total}`;
            document.getElementById('qr-modal').style.display = 'flex';
        } catch (error) {
            console.error("Error al procesar pedido: ", error);
            alert("Hubo un error al guardar tu orden. Inténtalo de nuevo.");
        }
    });
}

const btnCloseQr = document.getElementById('btn-close-qr');
if (btnCloseQr) {
    btnCloseQr.addEventListener('click', () => {
        document.getElementById('qr-modal').style.display = 'none';
    });
}

// Inicializar interfaz cliente al cargar archivo
document.addEventListener('DOMContentLoaded', updateCartUI);
