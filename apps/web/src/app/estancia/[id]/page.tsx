'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError, hasPermission } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Alert, Badge, Button, Card, Input, Modal, PageTitle, Spinner } from '@/components/ui';
import { formatCOP, formatDateTime } from '@/lib/format';

interface SessionDetail {
  id: string;
  plate: string;
  status: string;
  isTempPlate: boolean;
  vehicleType: { name: string };
  entryAt: string;
  exitAt: string | null;
  billedMinutes: number | null;
  total: number | null;
  notes: string | null;
  ticket: { id: string; code: string } | null;
  entryOperator: { fullName: string } | null;
  payments: Array<{ id: string; receiptNumber: string; amount: number; status: string; createdAt: string }>;
  incidents: Array<{ id: string; kind: string; description: string; createdAt: string }>;
}

const STATUS_LABEL: Record<string, { text: string; color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' }> = {
  ACTIVE: { text: 'Dentro del parqueadero', color: 'blue' },
  PENDING_PAYMENT: { text: 'Pendiente de pago', color: 'yellow' },
  PAID: { text: 'Pagada', color: 'green' },
  CLOSED: { text: 'Cerrada', color: 'green' },
  CANCELLED: { text: 'Anulada', color: 'red' },
  INCIDENT: { text: 'Con incidencia', color: 'red' },
};

export default function EstanciaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<null | 'cancel' | 'plate' | 'reprint'>(null);
  const [authorizer, setAuthorizer] = useState({ username: '', pin: '' });
  const [reason, setReason] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<SessionDetail>(`/sessions/${id}`).then(setSession).catch((e) => {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar.');
    });
  }, [id]);

  useEffect(load, [load]);

  async function doAction(path: string, body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method: 'POST', body });
      setModal(null);
      setNotice(successMsg);
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <AppShell>
        {error ? <Alert kind="error">{error}</Alert> : <Spinner />}
      </AppShell>
    );
  }

  const status = STATUS_LABEL[session.status] ?? { text: session.status, color: 'gray' as const };

  return (
    <AppShell>
      <PageTitle subtitle={`Ticket ${session.ticket?.code ?? '—'}`}>
        Estancia — {session.plate}
      </PageTitle>

      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Información</h2>
            <Badge color={status.color}>{status.text}</Badge>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Placa</dt>
              <dd className="font-mono text-xl font-bold">{session.plate}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tipo</dt>
              <dd>{session.vehicleType.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Entrada</dt>
              <dd>{formatDateTime(session.entryAt)}</dd>
            </div>
            {session.exitAt && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Salida</dt>
                <dd>{formatDateTime(session.exitAt)}</dd>
              </div>
            )}
            {session.total !== null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Total cobrado</dt>
                <dd className="font-bold">{formatCOP(session.total)}</dd>
              </div>
            )}
            {session.entryOperator && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Registró entrada</dt>
                <dd>{session.entryOperator.fullName}</dd>
              </div>
            )}
            {session.notes && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Observación</dt>
                <dd>{session.notes}</dd>
              </div>
            )}
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            {session.status === 'ACTIVE' && (
              <Button size="md" variant="success" onClick={() => router.push('/cobrar')}>
                Ir a cobrar
              </Button>
            )}
            <Button size="md" variant="ghost" onClick={() => setModal('reprint')}>
              Reimprimir ticket
            </Button>
            {session.status === 'ACTIVE' && hasPermission('sessions.fix_plate') && (
              <Button size="md" variant="ghost" onClick={() => setModal('plate')}>
                Corregir placa
              </Button>
            )}
            {session.status === 'ACTIVE' && (
              <Button size="md" variant="danger" onClick={() => setModal('cancel')}>
                Anular estancia
              </Button>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Pagos</h2>
            {session.payments.length === 0 ? (
              <p className="text-slate-400">Sin pagos registrados.</p>
            ) : (
              <div className="space-y-2">
                {session.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                    <div>
                      <span className="font-mono font-semibold">{p.receiptNumber}</span>
                      <span className="ml-2 text-sm text-slate-500">{formatDateTime(p.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === 'VOIDED' && <Badge color="red">Anulado</Badge>}
                      <span className="font-bold">{formatCOP(p.amount)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/print/receipt/${p.id}`, '_blank', 'width=400,height=600')}
                      >
                        Imprimir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {session.incidents.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Incidencias</h2>
              <div className="space-y-2 text-sm">
                {session.incidents.map((i) => (
                  <div key={i.id} className="rounded-xl bg-amber-50 px-3 py-2">
                    <span className="font-semibold">{i.kind}</span> — {i.description}
                    <span className="ml-2 text-slate-500">{formatDateTime(i.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal open={modal === 'cancel'} title="Anular estancia — requiere supervisor" onClose={() => setModal(null)}>
        <div className="flex flex-col gap-3">
          <Alert kind="warning">La anulación queda registrada en auditoría y no se puede deshacer.</Alert>
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input label="Usuario del supervisor" value={authorizer.username} onChange={(e) => setAuthorizer({ ...authorizer, username: e.target.value })} />
          <Input label="PIN del supervisor" type="password" value={authorizer.pin} onChange={(e) => setAuthorizer({ ...authorizer, pin: e.target.value })} />
          <Button
            variant="danger"
            loading={busy}
            onClick={() =>
              void doAction(
                `/sessions/${session.id}/cancel`,
                { authorizerUsername: authorizer.username, authorizerPin: authorizer.pin, reason },
                'Estancia anulada.',
              )
            }
          >
            Confirmar anulación
          </Button>
        </div>
      </Modal>

      <Modal open={modal === 'plate'} title="Corregir placa — requiere supervisor" onClose={() => setModal(null)}>
        <div className="flex flex-col gap-3">
          <Input label="Placa correcta" value={newPlate} onChange={(e) => setNewPlate(e.target.value.toUpperCase())} className="font-mono uppercase" />
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input label="Usuario del supervisor" value={authorizer.username} onChange={(e) => setAuthorizer({ ...authorizer, username: e.target.value })} />
          <Input label="PIN del supervisor" type="password" value={authorizer.pin} onChange={(e) => setAuthorizer({ ...authorizer, pin: e.target.value })} />
          <Button
            loading={busy}
            onClick={() =>
              void doAction(
                `/sessions/${session.id}/fix-plate`,
                { newPlate, authorizerUsername: authorizer.username, authorizerPin: authorizer.pin, reason },
                'Placa corregida.',
              )
            }
          >
            Guardar placa
          </Button>
        </div>
      </Modal>

      <Modal open={modal === 'reprint'} title="Reimprimir ticket" onClose={() => setModal(null)}>
        <div className="flex flex-col gap-3">
          <Alert kind="info">La reimpresión queda registrada en auditoría.</Alert>
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: ticket dañado" />
          <Button
            loading={busy}
            onClick={async () => {
              if (!session.ticket) return;
              setBusy(true);
              try {
                await api(`/sessions/tickets/${session.ticket.id}/reprint`, {
                  method: 'POST',
                  body: { reason: reason || 'Reimpresión' },
                });
                setModal(null);
                window.open(`/print/ticket/${session.id}`, '_blank', 'width=400,height=600');
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'No se pudo reimprimir.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Reimprimir
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
