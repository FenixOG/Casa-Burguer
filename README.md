# Casa Burguer - Plataforma de Pedidos Premium 🍔

Ecosistema digital completo para la gestión de ventas y pedidos online de la hamburguesería **Casa Burguer**, operando con orgullo desde el año 2020. Diseñado como Single Page Application optimizado para **GitHub Pages** y potenciado con **Firebase Firestore Cloud Engine**.

## 🚀 Características Principales
* **Página Pública Premium:** Diseño enfocado en conversiones, adaptable a smartphones y ordenadores, con integración de Google Maps, Modo Oscuro y botón de acción directa a WhatsApp.
* **Carrito en Tiempo Real:** Gestión reactiva de productos, cálculos automatizados de costos con pasarela simulada QR.
* **Panel de Control Administrativo:** Métricas avanzadas, control de flujo en cocina con alertas sonoras en vivo, gestión completa de productos e ingresos con gráficas integradas por Chart.js.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Cambiar a request.auth != null en producción estricta
    }
  }
}
