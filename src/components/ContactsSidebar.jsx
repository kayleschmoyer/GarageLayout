import React, { useState } from 'react';
import { Sheet, Typography, Button, IconButton, Modal, ModalDialog, Input, Stack, FormControl, FormLabel } from '@mui/joy';

const ContactsSidebar = ({ contacts, garageName, onUpdateContacts }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentContact, setCurrentContact] = useState({ id: null, name: '', title: '', phone: '', email: '' });

    // Reset form
    const resetForm = () => {
        setCurrentContact({ id: null, name: '', title: '', phone: '', email: '' });
        setIsEditing(false);
    };

    // Open Modal for Add
    const handleAddClick = () => {
        resetForm();
        setModalOpen(true);
    };

    // Open Modal for Edit
    const handleEditClick = (contact) => {
        setCurrentContact(contact);
        setIsEditing(true);
        setModalOpen(true);
    };

    // Save Contact (Add or Update)
    const handleSave = () => {
        if (!currentContact.name) return; // Basic validation

        let updatedList;
        if (isEditing) {
            updatedList = contacts.map(c => c.id === currentContact.id ? currentContact : c);
        } else {
            const newId = contacts.length > 0 ? Math.max(...contacts.map(c => c.id)) + 1 : 1;
            updatedList = [...contacts, { ...currentContact, id: newId }];
        }

        onUpdateContacts(updatedList);
        setModalOpen(false);
        resetForm();
    };

    // Delete Contact
    const handleDelete = (id) => {
        const updatedList = contacts.filter(c => c.id !== id);
        onUpdateContacts(updatedList);
    };

    return (
        <Sheet
            className="contacts-sidebar"
            sx={{
                width: 280,
                height: '100%',
                p: 2,
                borderRight: '1px solid',
                borderColor: 'neutral.outlinedBorder',
                bgcolor: 'background.surface',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                overflowY: 'auto',
                zIndex: 20
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>
                <Typography level="title-sm" sx={{ textTransform: 'uppercase', color: 'neutral.700', letterSpacing: '0.1em' }}>
                    {garageName || 'Contacts'}
                </Typography>
                <IconButton size="sm" variant="soft" color="primary" onClick={handleAddClick}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </IconButton>
            </div>

            {/* List */}
            <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto' }}>
                {!contacts || contacts.length === 0 ? (
                    <Typography level="body-sm" sx={{ textAlign: 'center', mt: 4, color: 'neutral.700', fontStyle: 'italic' }}>
                        No contacts added.
                    </Typography>
                ) : (
                    contacts.map((contact) => (
                        <Sheet
                            key={contact.id}
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: 'sm',
                                borderColor: 'neutral.outlinedBorder',
                                bgcolor: 'background.body',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: 'primary.300',
                                    transform: 'translateY(-2px)',
                                    boxShadow: 'sm'
                                },
                                position: 'relative',
                                group: 'true'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <Typography level="title-md" sx={{ fontWeight: 600, color: 'neutral.900' }}>{contact.name || 'Unknown'}</Typography>

                                {/* Actions (Edit/Delete) - visible on hover via CSS or always for improved UX */}
                                <div className="card-actions" style={{ display: 'flex', gap: 4 }}>
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        color="neutral"
                                        sx={{ p: 0.5, minHeight: 0 }}
                                        onClick={() => handleEditClick(contact)}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        </svg>
                                    </IconButton>
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        color="danger"
                                        sx={{ p: 0.5, minHeight: 0 }}
                                        onClick={() => handleDelete(contact.id)}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18" />
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                        </svg>
                                    </IconButton>
                                </div>
                            </div>

                            <Typography level="body-xs" sx={{ color: 'neutral.700', mb: 1, textTransform: 'uppercase', fontWeight: 600 }}>
                                {contact.title}
                            </Typography>

                            <Stack spacing={1}>
                                {contact.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7, color: 'var(--joy-palette-neutral-700)' }}>
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                        </svg>
                                        <Typography level="body-sm" sx={{ color: 'neutral.700' }}>{contact.phone}</Typography>
                                    </div>
                                )}
                                {contact.email && (
                                    <a
                                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${contact.email}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--joy-palette-primary-600)' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.8 }}>
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                            <polyline points="22,6 12,13 2,6" />
                                        </svg>
                                        <Typography level="body-sm" color="primary" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                                            {contact.email}
                                        </Typography>
                                    </a>
                                )}
                            </Stack>
                        </Sheet>
                    ))
                )}
            </Stack>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
                <ModalDialog sx={{
                    borderRadius: '12px',
                    p: 0,
                    width: '100%',
                    maxWidth: 400,
                    bgcolor: '#18181b',
                    border: '1px solid #3f3f46',
                    overflow: 'hidden'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #3f3f46',
                        background: '#27272a'
                    }}>
                        <Typography level="h4" sx={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>
                            {isEditing ? 'Edit Contact' : 'Add New Contact'}
                        </Typography>
                    </div>

                    {/* Form Content */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Name */}
                        <FormControl>
                            <FormLabel sx={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>Name</FormLabel>
                            <Input
                                size="sm"
                                autoFocus
                                value={currentContact.name}
                                onChange={(e) => setCurrentContact({ ...currentContact, name: e.target.value })}
                                placeholder="e.g. Jane Doe"
                                sx={{
                                    fontSize: 14,
                                    color: '#fafafa',
                                    bgcolor: '#27272a',
                                    borderColor: '#3f3f46',
                                    '&:hover': { borderColor: '#52525b' },
                                    '&:focus-within': { borderColor: '#3b82f6' },
                                    '&::placeholder': { color: '#71717a' }
                                }}
                            />
                        </FormControl>

                        {/* Title / Role */}
                        <FormControl>
                            <FormLabel sx={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>Title / Role</FormLabel>
                            <Input
                                size="sm"
                                value={currentContact.title}
                                onChange={(e) => setCurrentContact({ ...currentContact, title: e.target.value })}
                                placeholder="e.g. Manager"
                                sx={{
                                    fontSize: 14,
                                    color: '#fafafa',
                                    bgcolor: '#27272a',
                                    borderColor: '#3f3f46',
                                    '&:hover': { borderColor: '#52525b' },
                                    '&:focus-within': { borderColor: '#3b82f6' },
                                    '&::placeholder': { color: '#71717a' }
                                }}
                            />
                        </FormControl>

                        {/* Phone */}
                        <FormControl>
                            <FormLabel sx={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>Phone</FormLabel>
                            <Input
                                size="sm"
                                value={currentContact.phone}
                                onChange={(e) => setCurrentContact({ ...currentContact, phone: e.target.value })}
                                placeholder="(555) 000-0000"
                                sx={{
                                    fontSize: 14,
                                    color: '#fafafa',
                                    bgcolor: '#27272a',
                                    borderColor: '#3f3f46',
                                    '&:hover': { borderColor: '#52525b' },
                                    '&:focus-within': { borderColor: '#3b82f6' },
                                    '&::placeholder': { color: '#71717a' }
                                }}
                            />
                        </FormControl>

                        {/* Email */}
                        <FormControl>
                            <FormLabel sx={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>Email</FormLabel>
                            <Input
                                size="sm"
                                value={currentContact.email}
                                onChange={(e) => setCurrentContact({ ...currentContact, email: e.target.value })}
                                placeholder="email@example.com"
                                sx={{
                                    fontSize: 14,
                                    color: '#fafafa',
                                    bgcolor: '#27272a',
                                    borderColor: '#3f3f46',
                                    '&:hover': { borderColor: '#52525b' },
                                    '&:focus-within': { borderColor: '#3b82f6' },
                                    '&::placeholder': { color: '#71717a' }
                                }}
                            />
                        </FormControl>
                    </div>

                    {/* Footer Actions */}
                    <div style={{
                        display: 'flex',
                        gap: 10,
                        justifyContent: 'flex-end',
                        padding: '14px 20px',
                        borderTop: '1px solid #3f3f46',
                        background: '#27272a'
                    }}>
                        <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            onClick={() => setModalOpen(false)}
                            sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave}>
                            {isEditing ? 'Save Changes' : 'Add Contact'}
                        </Button>
                    </div>
                </ModalDialog>
            </Modal>
        </Sheet>
    );
};

export default ContactsSidebar;
