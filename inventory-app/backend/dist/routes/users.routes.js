"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authenticate);
// Rutas de usuarios
router.get('/', users_controller_1.getUsers);
router.get('/:id', users_controller_1.getUserById);
router.post('/', users_controller_1.createUser);
router.put('/:id', users_controller_1.updateUser);
router.delete('/:id', users_controller_1.deleteUser);
exports.default = router;
//# sourceMappingURL=users.routes.js.map