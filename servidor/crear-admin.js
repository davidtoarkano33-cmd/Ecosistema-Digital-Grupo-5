// servidor/crear-admin.js · Script para crear un usuario administrador desde consola
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('\n=== Crear Usuario Administrador (UNEMI) ===\n');

    const nombre = (await rl.question('Nombre: ')).trim();
    if (!nombre) {
      console.error('El nombre no puede estar vacío.');
      return;
    }

    const apellido = (await rl.question('Apellido: ')).trim();
    if (!apellido) {
      console.error('El apellido no puede estar vacío.');
      return;
    }

    const correo = (await rl.question('Correo electrónico: ')).trim().toLowerCase();
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      console.error('Formato de correo inválido.');
      return;
    }

    const usuarios = await almacen.leer('usuarios');
    if (usuarios.some(u => u.correo && u.correo.toLowerCase() === correo)) {
      console.error('Ese correo ya está registrado.');
      return;
    }

    const clave = (await rl.question('Contraseña (mínimo 8 caracteres con letras y números): ')).trim();
    if (clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) {
      console.error('La contraseña debe tener al menos 8 caracteres y contener letras y números.');
      return;
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoAdmin = {
      nombre,
      apellido,
      correo,
      claveHash,
      rol: 'admin',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoAdmin);
    console.log(`\n¡Administrador creado con éxito!`);
    console.log(`ID: ${creado.id}`);
    console.log(`Usuario: ${creado.nombre} ${creado.apellido} (${creado.correo})\n`);
  } catch (err) {
    console.error('Error al crear administrador:', err.message);
  } finally {
    rl.close();
  }
}

main();
