import React, { useState, useCallback, useMemo } from 'react';
import { Sheet, Typography, Button, IconButton, Modal, ModalDialog, Input, Stack, FormControl, FormLabel } from '@mui/joy';

const DEFAULT_CONTACT = Object.freeze({ id: null, name: '', title: '', phone: '', email: '' });

const INPUT_STYLES = Object.freeze({
    fontSize: 14,
    color: '#fafafa',
    bgcolor: '#27272a',
    borderColor: '#3f3f46',
    '&:hover': { borderColor: '#52525b' },
    '&:focus-within': { borderColor: '#3b82f6' },
    '&::placeholder': { color: '#71717a' }
});

const LABEL_STYLES = Object.freeze({
    fontSize: 12,
    fontWeight: 600,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    mb: 0.5
});

const validateContact = (contact) => {
    if (!contact || typeof contact !== 'object') return false;
    if (typeof contact.name !== 'string' || contact.name.trim().length === 0) return false;
    return true;
};

const sanitizeContact = (contact) => {
    if (!contact || typeof contact !== 'object') return { ...DEFAULT_CONTACT };
    return {
        id: contact.id ?? null,
        name: typeof contact.name === 'string' ? contact.name.trim() : '',
        title: typeof contact.title === 'string' ? contact.title.trim() : '',
        phone: typeof contact.phone === 'string' ? contact.phone.trim() : '',
        email: typeof contact.email === 'string' ? contact.email.trim().toLowerCase() : ''
    };
};

const generateContactId = (contacts) => {
    if (!Array.isArray(contacts) || contacts.length === 0) return 1;
    const ids = contacts.map(c => (typeof c?.id === 'number' ? c.id : 0)).filter(id => id > 0);
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
};

const PhoneIcon = React.memo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7, color: 'var(--joy-palette-neutral-700)', flexShrink: 0 }}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
));

const EmailIcon = React.memo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.8, flexShrink: 0 }}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
));

const EditIcon = React.memo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
));

const DeleteIcon = React.memo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
));

const AddIcon = React.memo(() => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
    </svg>
));

const ContactCard = React.memo(({ contact, onEdit, onDelete }) => {
    const handleEdit = useCallback(() => {
        if (contact) onEdit(contact);
    }, [contact, onEdit]);

    const handleDelete = useCallback(() => {
        if (contact?.id != null) onDelete(contact.id);
    }, [contact, onDelete]);

    if (!contact) return null;

    const displayName = contact.name || 'Unknown';
    const displayTitle = contact.title || '';
    const displayPhone = contact.phone || '';
    const displayEmail = contact.email || '';

    return (
        <Sheet
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
                position: 'relative'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <Typography level="title-md" sx={{ fontWeight: 600, color: 'neutral.900', wordBreak: 'break-word', pr: 1 }}>
                    {displayName}
                </Typography>
                <div className="card-actions" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        sx={{ p: 0.5, minHeight: 0 }}
                        onClick={handleEdit}
                        aria-label="Edit contact"
                    >
                        <EditIcon />
                    </IconButton>
                    <IconButton
                        size="sm"
                        variant="plain"
                        color="danger"
                        sx={{ p: 0.5, minHeight: 0 }}
                        onClick={handleDelete}
                        aria-label="Delete contact"
                    >
                        <DeleteIcon />
                    </IconButton>
                </div>
            </div>

            {displayTitle && (
                <Typography level="body-xs" sx={{ color: 'neutral.700', mb: 1, textTransform: 'uppercase', fontWeight: 600 }}>
                    {displayTitle}
                </Typography>
            )}

            <Stack spacing={1}>
                {displayPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PhoneIcon />
                        <Typography level="body-sm" sx={{ color: 'neutral.700', wordBreak: 'break-all' }}>
                            {displayPhone}
                        </Typography>
                    </div>
                )}
                {displayEmail && (
                    <a
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(displayEmail)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--joy-palette-primary-600)' }}
                    >
                        <EmailIcon />
                        <Typography level="body-sm" color="primary" sx={{ '&:hover': { textDecoration: 'underline' }, wordBreak: 'break-all' }}>
                            {displayEmail}
                        </Typography>
                    </a>
                )}
            </Stack>
        </Sheet>
    );
});

ContactCard.displayName = 'ContactCard';

const ContactsSidebar = ({ contacts, garageName, onUpdateContacts }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentContact, setCurrentContact] = useState({ ...DEFAULT_CONTACT });
    const [isSaving, setIsSaving] = useState(false);

    const safeContacts = useMemo(() => {
        if (!Array.isArray(contacts)) return [];
        return contacts.filter(c => c && typeof c === 'object' && c.id != null);
    }, [contacts]);

    const resetForm = useCallback(() => {
        setCurrentContact({ ...DEFAULT_CONTACT });
        setIsEditing(false);
        setIsSaving(false);
    }, []);

    const handleCloseModal = useCallback(() => {
        if (isSaving) return;
        setModalOpen(false);
        resetForm();
    }, [isSaving, resetForm]);

    const handleAddClick = useCallback(() => {
        resetForm();
        setModalOpen(true);
    }, [resetForm]);

    const handleEditClick = useCallback((contact) => {
        if (!contact) return;
        setCurrentContact(sanitizeContact(contact));
        setIsEditing(true);
        setModalOpen(true);
    }, []);

    const handleSave = useCallback(() => {
        if (isSaving) return;

        const sanitized = sanitizeContact(currentContact);
        if (!validateContact(sanitized)) return;

        setIsSaving(true);

        try {
            let updatedList;
            if (isEditing && sanitized.id != null) {
                updatedList = safeContacts.map(c =>
                    c.id === sanitized.id ? { ...sanitized } : c
                );
            } else {
                const newId = generateContactId(safeContacts);
                updatedList = [...safeContacts, { ...sanitized, id: newId }];
            }

            if (typeof onUpdateContacts === 'function') {
                onUpdateContacts(updatedList);
            }

            setModalOpen(false);
            resetForm();
        } catch (error) {
            setIsSaving(false);
        }
    }, [currentContact, isEditing, isSaving, onUpdateContacts, resetForm, safeContacts]);

    const handleDelete = useCallback((id) => {
        if (id == null) return;
        const updatedList = safeContacts.filter(c => c.id !== id);
        if (typeof onUpdateContacts === 'function') {
            onUpdateContacts(updatedList);
        }
    }, [onUpdateContacts, safeContacts]);

    const handleInputChange = useCallback((field) => (e) => {
        const value = e?.target?.value ?? '';
        setCurrentContact(prev => ({ ...prev, [field]: value }));
    }, []);

    const displayName = 'Contacts';

    const isFormValid = useMemo(() => {
        return typeof currentContact.name === 'string' && currentContact.name.trim().length > 0;
    }, [currentContact.name]);

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>
                <Typography level="title-sm" sx={{ textTransform: 'uppercase', color: 'neutral.700', letterSpacing: '0.1em' }}>
                    {displayName}
                </Typography>
                <IconButton size="sm" variant="soft" color="primary" onClick={handleAddClick} aria-label="Add contact">
                    <AddIcon />
                </IconButton>
            </div>

            <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pt: 0.5 }}>
                {safeContacts.length === 0 ? (
                    <Typography level="body-sm" sx={{ textAlign: 'center', mt: 4, color: 'neutral.700', fontStyle: 'italic' }}>
                        No contacts added.
                    </Typography>
                ) : (
                    safeContacts.map((contact) => (
                        <ContactCard
                            key={contact.id}
                            contact={contact}
                            onEdit={handleEditClick}
                            onDelete={handleDelete}
                        />
                    ))
                )}
            </Stack>

            <Modal open={modalOpen} onClose={handleCloseModal}>
                <ModalDialog sx={{
                    borderRadius: '12px',
                    p: 0,
                    width: '100%',
                    maxWidth: 400,
                    bgcolor: '#18181b',
                    border: '1px solid #3f3f46',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #3f3f46',
                        background: '#27272a'
                    }}>
                        <Typography level="h4" sx={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>
                            {isEditing ? 'Edit Contact' : 'Add New Contact'}
                        </Typography>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <FormControl>
                            <FormLabel sx={LABEL_STYLES}>Name *</FormLabel>
                            <Input
                                size="sm"
                                autoFocus
                                value={currentContact.name}
                                onChange={handleInputChange('name')}
                                placeholder="e.g. Jane Doe"
                                disabled={isSaving}
                                sx={INPUT_STYLES}
                            />
                        </FormControl>

                        <FormControl>
                            <FormLabel sx={LABEL_STYLES}>Title / Role</FormLabel>
                            <Input
                                size="sm"
                                value={currentContact.title}
                                onChange={handleInputChange('title')}
                                placeholder="e.g. Manager"
                                disabled={isSaving}
                                sx={INPUT_STYLES}
                            />
                        </FormControl>

                        <FormControl>
                            <FormLabel sx={LABEL_STYLES}>Phone</FormLabel>
                            <Input
                                size="sm"
                                value={currentContact.phone}
                                onChange={handleInputChange('phone')}
                                placeholder="(555) 000-0000"
                                disabled={isSaving}
                                sx={INPUT_STYLES}
                            />
                        </FormControl>

                        <FormControl>
                            <FormLabel sx={LABEL_STYLES}>Email</FormLabel>
                            <Input
                                size="sm"
                                type="email"
                                value={currentContact.email}
                                onChange={handleInputChange('email')}
                                placeholder="email@example.com"
                                disabled={isSaving}
                                sx={INPUT_STYLES}
                            />
                        </FormControl>
                    </div>

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
                            onClick={handleCloseModal}
                            disabled={isSaving}
                            sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving || !isFormValid}
                            loading={isSaving}
                        >
                            {isEditing ? 'Save Changes' : 'Add Contact'}
                        </Button>
                    </div>
                </ModalDialog>
            </Modal>
        </Sheet>
    );
};

export default React.memo(ContactsSidebar);
