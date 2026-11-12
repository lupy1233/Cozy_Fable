'use client';

import { useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ROOM_TYPES, type RoomType } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dropzone } from '@/components/ui/dropzone';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { useCreateInspiration, useUploadInspirationImage } from '@/hooks/use-admin-inspiration';
import { useAdminCompanies } from '@/hooks/use-company';
import { TITLE_MAX, TITLE_MIN } from './edit-tags-dialog';
import { IMAGE_ACCEPT } from './photo-card';
import { EMPTY_TAGS, TagFields, type TagValues } from './tag-fields';

// Adaugarea unei lucrari: datele + etichetele pleaca prin create; imaginea aleasa aici se
// incarca imediat dupa, prin acelasi flux presign folosit pe carduri (invarianta 3.4).
export function AddPhotoForm() {
  const t = useTranslations('AdminInspiration');
  const tc = useTranslations('Configurator');
  const companies = useAdminCompanies();
  const create = useCreateInspiration();
  const upload = useUploadInspirationImage();

  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('KITCHEN');
  const [tags, setTags] = useState<TagValues>(EMPTY_TAGS);
  const [imageUrl, setImageUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const busy = create.isPending || upload.isPending;
  const titleOk = title.trim().length >= TITLE_MIN;
  const canSubmit = titleOk && !!companyId && !busy;

  const pickFile = (files: FileList) => {
    const f = files[0];
    if (!f) return;
    if (!IMAGE_ACCEPT.split(',').includes(f.type)) {
      toast.error(t('invalidImage'));
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!canSubmit) return;
    const created = await create
      .mutateAsync({
        title: title.trim(),
        companyId,
        roomType,
        ...tags,
        // cu un fisier ales, imaginea vine din upload, nu din URL
        imageUrl: file ? undefined : imageUrl.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        published: true,
      })
      .catch(() => null);
    if (!created) {
      toast.error(t('actionError'));
      return;
    }
    // lucrarea exista deja: formularul se goleste (firma si tipul raman, pentru urmatoarea)
    setTitle('');
    setImageUrl('');
    setSourceUrl('');
    setTags(EMPTY_TAGS);
    const picked = file;
    setFile(null);
    if (!picked) {
      toast.success(t('created'));
      return;
    }
    try {
      await upload.mutateAsync({ id: created.id, file: picked });
      toast.success(t('created'));
    } catch {
      toast.error(t('createdUploadFailed'));
    }
  };

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby="inspiration-add-title"
      className="flex min-w-0 flex-col gap-4 p-6 lg:w-[360px] lg:shrink-0"
    >
      <h2 id="inspiration-add-title" className="heading-section">
        {t('addTitle')}
      </h2>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-border-2 bg-surface-2 px-3.5 py-3 text-sm">
          <ImageIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate" title={file.name}>
            {file.name}
          </span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label={t('removeFile')} disabled={busy}>
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Dropzone
          onFiles={pickFile}
          accept={IMAGE_ACCEPT}
          multiple={false}
          label={t('dropLabel')}
          hint={t('dropHint')}
          className="min-h-[120px] border px-3.5 py-3.5"
        />
      )}

      <Field label={t('fields.title')} error={title.trim() !== '' && !titleOk ? t('titleTooShort') : undefined}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} className="h-11" />
      </Field>
      <Field label={t('fields.company')}>
        <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-11">
          <option value="">{t('fields.companyPlaceholder')}</option>
          {companies.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('fields.roomType')}>
        <Select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)} className="h-11">
          {ROOM_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {tc(`rooms.type.${rt}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('fields.sourceUrl')} hint={t('fields.sourceUrlHint')}>
        <Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" className="h-11" />
      </Field>
      {!file && (
        <Field label={t('fields.imageUrl')} hint={t('fields.imageUrlHint')}>
          <Input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="h-11" />
        </Field>
      )}

      <TagFields value={tags} onChange={setTags} />

      <Button type="button" variant="walnut" size="xl" className="w-full px-4 text-sm" disabled={!canSubmit} onClick={() => void submit()}>
        {busy ? t('adding') : t('addButton')}
      </Button>
      <p className="text-xs text-muted-foreground">{t('addNote')}</p>
    </Card>
  );
}
