'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Badge, Button, Card, Input, Modal, PageTitle, Spinner } from '@/components/ui';

interface User {
  id: string;
  username: string;
  fullName: string;
  active: boolean;
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  OPERATOR: 'Operador',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Administrador',
  AUDITOR: 'Auditor',
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ username: '', fullName: '', password: '', pin: '', role: 'OPERATOR' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<User[]>('/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(load, [load]);

  async function create() {
    setBusy(true);
    setError('');
    try {
      await api('/users', {
        method: 'POST',
        body: {
          username: form.username,
          fullName: form.fullName,
          password: form.password,
          pin: form.pin || undefined,
          roleCodes: [form.role],
        },
      });
      setModal(false);
      setForm({ username: '', fullName: '', password: '', pin: '', role: 'OPERATOR' });
      setNotice('Usuario creado.');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: User) {
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar.');
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Usuarios</PageTitle>
        <Button size="md" onClick={() => setModal(true)}>
          + Nuevo usuario
        </Button>
      </div>

      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {users === null ? (
        <Spinner />
      ) : (
        <Card>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="py-2">Usuario</th>
                <th>Nombre</th>
                <th>Roles</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-3 font-mono">{u.username}</td>
                  <td>{u.fullName}</td>
                  <td>
                    <div className="flex gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} color="blue">
                          {ROLE_LABELS[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge color={u.active ? 'green' : 'red'}>{u.active ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive(u)}>
                      {u.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={modal} title="Nuevo usuario" onClose={() => setModal(false)}>
        <div className="flex flex-col gap-3">
          <Input label="Usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Nombre completo" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Contraseña (mínimo 6 caracteres)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input label="PIN de autorización (opcional, para supervisores)" type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Rol</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              {Object.entries(ROLE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          <Button loading={busy} onClick={() => void create()}>
            Crear usuario
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
