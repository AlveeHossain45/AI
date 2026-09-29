import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Plus, Search, MessageSquare, Settings, ShieldCheck, LogOut, FolderPlus, Folder, MoreHorizontal,
  Pencil, Trash2, Download, ChevronDown, X, Check,
} from 'lucide-react';
import Logo from './ui/Logo.jsx';
import ThemeToggle from './ui/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { useDebounce } from '../hooks/useUtils.js';

export default function Sidebar ({ open, onClose, activeConversationId }) {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { push } = useToast();

  const [conversations, setConversations] = useState([]);
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [moveFor, setMoveFor] = useState(null);

  const searchRef = useRef(null);
  const debouncedSearch = useDebounce(search, 300);

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (folderFilter) params.set('folderId', folderFilter);
      params.set('limit', '50');
      const data = await api.get(`/api/conversations?${params.toString()}`);
      setConversations(data.conversations || []);
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, folderFilter, push]);

  const loadFolders = useCallback(async () => {
    try {
      const data = await api.get('/api/conversations/meta/folders/list');
      setFolders(data.folders || []);
    } catch { /* folders are optional */ }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadFolders(); }, [loadFolders]);

  // Ctrl/Cmd + K focuses conversation search
  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    const onFocusRequest = () => searchRef.current?.focus();
    window.addEventListener('novaai:focus-search', onFocusRequest);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('novaai:focus-search', onFocusRequest);
    };
  }, []);

  // Close floating menus when clicking outside (listener attaches after the
  // opening click has finished propagating, so it never closes immediately).
  useEffect(() => {
    if (!menuFor && !moveFor && !profileOpen) return undefined;
    const closeMenus = () => {
      setMenuFor(null);
      setMoveFor(null);
      setProfileOpen(false);
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, [menuFor, moveFor, profileOpen]);

  const startNewChat = () => {
    navigate('/chat');
    onClose?.();
  };

  const handleRename = async (id) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      await api.patch(`/api/conversations/${id}`, { title });
      setConversations((current) => current.map((item) => (item.id === id ? { ...item, title } : item)));
    } catch (error) {
      push(error.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await api.del(`/api/conversations/${id}`);
      setConversations((current) => current.filter((item) => item.id !== id));
      if (activeConversationId === id) navigate('/chat');
      push('Conversation deleted', 'success');
    } catch (error) {
      push(error.message, 'error');
    }
  };

  const handleExport = async (id) => {
    try {
      const response = await fetch(`/api/conversations/${id}/export?format=md`, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'novaai-chat.md';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      push('Could not export this conversation', 'error');
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName('');
    if (!name) return;
    try {
      const data = await api.post('/api/conversations/meta/folders', { name });
      setFolders((current) => [...current, data.folder]);
      push('Folder created', 'success');
    } catch (error) {
      push(error.message, 'error');
    }
  };

  const deleteFolder = async (id) => {
    try {
      await api.del(`/api/conversations/meta/folders/${id}`);
      setFolders((current) => current.filter((folder) => folder.id !== id));
      if (folderFilter === id) setFolderFilter(null);
    } catch (error) {
      push(error.message, 'error');
    }
  };

  const moveToFolder = async (conversationId, targetFolderId) => {
    setMoveFor(null);
    try {
      await api.patch(`/api/conversations/${conversationId}`, { folderId: targetFolderId });
      await loadConversations();
      push(targetFolderId ? 'Moved to folder' : 'Removed from folder', 'success', 2000);
    } catch (error) {
      push(error.message, 'error');
    }
  };

  const initials = (user?.name || user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 dark:border-white/10 dark:bg-surface-dark-2 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <Logo size="md" to="/chat" onClick={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-4">
          <button type="button" onClick={startNewChat} className="btn-primary w-full">
            <Plus size={16} />
            New chat
            <span className="ml-auto rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</span>
          </button>

          <div className="relative mt-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="input !pl-9 !py-2 text-[13px]"
            />
          </div>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Conversations">
          {folders.length || creatingFolder ? (
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Folders</span>
                <button
                  type="button"
                  onClick={() => setCreatingFolder(true)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                  aria-label="Create folder"
                >
                  <FolderPlus size={14} />
                </button>
              </div>
              {creatingFolder ? (
                <div className="mb-1 flex gap-1.5 px-1">
                  <input
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') createFolder(); if (event.key === 'Escape') setCreatingFolder(false); }}
                    placeholder="Folder name"
                    className="input !py-1.5 text-xs"
                    autoFocus
                  />
                  <button type="button" onClick={createFolder} className="btn-primary !px-2 !py-1.5" aria-label="Save folder">
                    <Check size={14} />
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setFolderFilter(null)}
                className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ${
                  folderFilter === null ? 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                <Folder size={14} /> All conversations
              </button>
              {folders.map((folder) => (
                <div key={folder.id} className="group/f flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFolderFilter(folder.id === folderFilter ? null : folder.id)}
                    className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ${
                      folderFilter === folder.id ? 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
                    }`}
                  >
                    <Folder size={14} />
                    <span className="truncate">{folder.name}</span>
                    <span className="ml-auto text-[10px] opacity-60">{folder._count?.conversations ?? ''}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`Delete folder "${folder.name}"? Conversations are kept.`)) deleteFolder(folder.id); }}
                    className="rounded p-1 text-slate-300 opacity-0 transition hover:text-rose-500 group-hover/f:opacity-100 dark:text-slate-600"
                    aria-label={`Delete folder ${folder.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {debouncedSearch ? 'Results' : 'Recent'}
          </div>

          {loading ? (
            <div className="space-y-2 px-1">
              {[0, 1, 2].map((index) => <div key={index} className="skeleton h-9 w-full" />)}
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-3 text-xs text-slate-400">
              {debouncedSearch ? 'No conversations match your search.' : 'No conversations yet. Start a new chat!'}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((item) => (
                <li key={item.id} className="group/c relative">
                  {renamingId === item.id ? (
                    <div className="flex gap-1 px-1">
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') handleRename(item.id); if (event.key === 'Escape') setRenamingId(null); }}
                        className="input !py-1.5 text-[13px]"
                        autoFocus
                        aria-label="Conversation title"
                      />
                      <button type="button" onClick={() => handleRename(item.id)} className="btn-primary !px-2 !py-1.5" aria-label="Save title">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className={`group/c relative flex items-center rounded-xl transition ${
                      activeConversationId === item.id
                        ? 'bg-brand-500/10'
                        : 'hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}>
                      <NavLink
                        to={`/chat/${item.id}`}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-[13.5px] transition ${
                            isActive || activeConversationId === item.id
                              ? 'font-semibold text-brand-600 dark:text-brand-300'
                              : 'text-slate-600 dark:text-slate-300'
                          }`
                        }
                      >
                        <MessageSquare size={15} className="shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </NavLink>
                      <button
                        type="button"
                        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMenuFor(menuFor === item.id ? null : item.id); }}
                        className="absolute right-1 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-black/5 group-hover/c:opacity-100 focus:opacity-100 dark:text-slate-600 dark:hover:bg-white/10"
                        aria-label={`Options for ${item.title}`}
                        aria-haspopup="menu"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  )}

                  {menuFor === item.id ? (
                    <div className="absolute right-1 top-9 z-30 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-card dark:border-white/10 dark:bg-surface-dark-3">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                        onClick={() => { setRenamingId(item.id); setRenameValue(item.title); setMenuFor(null); }}
                      >
                        <Pencil size={13} /> Rename
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                        onClick={() => { setMoveFor(moveFor === item.id ? null : item.id); setMenuFor(null); }}
                      >
                        <Folder size={13} /> Move to folder
                        <ChevronDown size={12} className="ml-auto" />
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                        onClick={() => { handleExport(item.id); setMenuFor(null); }}
                      >
                        <Download size={13} /> Export as Markdown
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        onClick={() => { handleDelete(item.id); setMenuFor(null); }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  ) : null}

                  {moveFor === item.id ? (
                    <div className="absolute right-1 top-9 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-card dark:border-white/10 dark:bg-surface-dark-3">
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                        onClick={() => moveToFolder(item.id, null)}
                      >
                        No folder
                      </button>
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          className="w-full truncate rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                          onClick={() => moveToFolder(item.id, folder.id)}
                        >
                          {folder.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-white/10">
          <div className="mb-2 flex items-center gap-1">
            <NavLink
              to="/settings"
              onClick={onClose}
              className={({ isActive }) =>
                `flex flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] transition ${
                  isActive ? 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }`
              }
            >
              <Settings size={15} /> Settings
            </NavLink>
            {isAdmin ? (
              <NavLink
                to="/admin"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] transition ${
                    isActive ? 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                  }`
                }
                aria-label="Admin dashboard"
                title="Admin dashboard"
              >
                <ShieldCheck size={15} />
                <span className="lg:hidden">Admin</span>
              </NavLink>
            ) : null}
            <ThemeToggle />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-slate-100 dark:hover:bg-white/5"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-violet-600 text-xs font-bold text-white">
                {initials}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  {user?.name || 'Account'}
                </span>
                <span className="block truncate text-[11px] text-slate-400">{user?.email}</span>
              </span>
              <ChevronDown size={14} className={`text-slate-400 transition ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen ? (
              <div role="menu" className="absolute bottom-12 left-0 z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-card dark:border-white/10 dark:bg-surface-dark-3">
                <NavLink
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <Settings size={13} /> Settings
                </NavLink>
                <button
                  type="button"
                  onClick={async () => { await logout(); setProfileOpen(false); navigate('/'); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
