import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, X } from 'lucide-react';
import { consumeSelectedClientFilter, loadJson, saveJson } from '../lib/storage';

type ClientStatus = 'Ativo' | 'Em Análise' | 'Inativo';

interface Client {
  id: string;
  name: string;
  type: string;
  contact: string;
  email: string;
  phone: string;
  location: string;
  status: ClientStatus;
}

const seedClients: Client[] = [
  { id: 'c-1', name: 'Fazenda Boa Esperança', type: 'Agronegócio', contact: 'João Silva', email: 'joao@boaesperanca.com', phone: '(11) 98765-4321', location: 'Ribeirão Preto, SP', status: 'Ativo' },
  { id: 'c-2', name: 'Indústria ABC Ltda', type: 'Manufatura', contact: 'Maria Souza', email: 'maria@abc.ind.br', phone: '(11) 91234-5678', location: 'Guarulhos, SP', status: 'Ativo' },
  { id: 'c-3', name: 'Mineração XYZ', type: 'Mineração', contact: 'Carlos Mendes', email: 'carlos@xyz.com', phone: '(31) 99876-5432', location: 'Belo Horizonte, MG', status: 'Em Análise' },
  { id: 'c-4', name: 'Posto Central', type: 'Comércio', contact: 'Ana Paula', email: 'ana@postocentral.com', phone: '(21) 98888-7777', location: 'Rio de Janeiro, RJ', status: 'Inativo' },
];

const emptyDraft: Omit<Client, 'id'> = {
  name: '',
  type: '',
  contact: '',
  email: '',
  phone: '',
  location: '',
  status: 'Ativo',
};

export default function CRM() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | ClientStatus>('Todos');
  const [typeFilter, setTypeFilter] = useState<'Todos' | string>('Todos');
  const [clients, setClients] = useState<Client[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Client, 'id'>>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadJson<Client[]>('ecofin.clients.v1', []);
    if (stored.length > 0) {
      setClients(stored);
      setHydrated(true);
      return;
    }
    saveJson('ecofin.clients.v1', seedClients);
    setClients(seedClients);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const selected = consumeSelectedClientFilter();
    if (selected) {
      setSearchTerm(selected);
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJson('ecofin.clients.v1', clients);
  }, [clients, hydrated]);

  const clientTypes = useMemo(() => {
    const uniq = Array.from(new Set(clients.map(c => c.type).filter(Boolean)));
    uniq.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniq;
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesQuery =
        q.length === 0 ||
        c.name.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'Todos' ? true : c.status === statusFilter;
      const matchesType = typeFilter === 'Todos' ? true : c.type === typeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [clients, searchTerm, statusFilter, typeFilter]);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingId(client.id);
    const { id: _id, ...rest } = client;
    setDraft(rest);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError(null);
  };

  const upsertClient = () => {
    const name = draft.name.trim();
    const type = draft.type.trim();
    const contact = draft.contact.trim();
    const email = draft.email.trim();
    const phone = draft.phone.trim();
    const location = draft.location.trim();

    if (!name || !type || !contact) {
      setFormError('Preencha pelo menos Empresa, Tipo e Contato.');
      return;
    }

    const nextDraft: Omit<Client, 'id'> = {
      ...draft,
      name,
      type,
      contact,
      email,
      phone,
      location,
    };

    if (editingId) {
      setClients((prev) => prev.map((c) => (c.id === editingId ? { id: editingId, ...nextDraft } : c)));
      closeModal();
      return;
    }

    const id = `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setClients((prev) => [{ id, ...nextDraft }, ...prev]);
    closeModal();
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes (CRM)</h1>
          <p className="text-slate-500">Gerencie seus clientes e contatos.</p>
        </div>
        <button
          onClick={openNew}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar clientes..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="Todos">Todos os Tipos</option>
              {clientTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Em Análise">Em Análise</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4 font-medium">Empresa</th>
                <th className="p-4 font-medium">Contato</th>
                <th className="p-4 font-medium">Localização</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{client.name}</p>
                        <p className="text-sm text-slate-500">{client.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{client.contact}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {client.location}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      client.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' :
                      client.status === 'Em Análise' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(client)}
                        className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteClient(client.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" onClick={closeModal} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Editar Cliente' : 'Novo Cliente'}
                </h2>
                <p className="text-sm text-slate-500">Cadastre e mantenha os dados de contato atualizados.</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-xl px-4 py-3 text-sm font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Empresa *</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: Fazenda Boa Esperança"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Tipo *</span>
                  <input
                    value={draft.type}
                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: Agronegócio"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Contato *</span>
                  <input
                    value={draft.contact}
                    onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: João Silva"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ClientStatus }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Em Análise">Em Análise</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">E-mail</span>
                  <input
                    value={draft.email}
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="nome@empresa.com"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Telefone</span>
                  <input
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="(00) 00000-0000"
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Localização</span>
                  <input
                    value={draft.location}
                    onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Cidade, UF"
                  />
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                * Campos obrigatórios
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={upsertClient}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
