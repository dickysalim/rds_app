import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getBusinessAliasLogoUrl, type BusinessInput } from '@/lib/business'
import { getCroppedImageBlob } from '@/lib/cropImage'
import {
  useBusinessAliasesQuery,
  useCreateBusinessAliasMutation,
  useUpdateBusinessAliasMutation,
  useUploadBusinessAliasLogoMutation,
} from '@/lib/queries'

const emptyForm = {
  business_name: '',
  business_address: '',
  business_contact_person: '',
  business_contact_number: '',
  business_email: '',
  payment_bank_name: '',
  payment_account_name: '',
  payment_account_number: '',
}

export function AliasEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const businessId = id ? Number(id) : null
  const { data: aliases = [], isLoading: loading } = useBusinessAliasesQuery()
  const alias = businessId != null ? (aliases.find((a) => a.business_id === businessId) ?? null) : null

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const createMutation = useCreateBusinessAliasMutation()
  const updateMutation = useUpdateBusinessAliasMutation()
  const uploadLogoMutation = useUploadBusinessAliasLogoMutation()
  const saving = createMutation.isPending || updateMutation.isPending

  const [hasLogo, setHasLogo] = useState(false)
  const [logoVersion, setLogoVersion] = useState(0)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (businessId == null) {
      setForm(emptyForm)
      setHasLogo(false)
      setInitialized(true)
      return
    }
    if (!alias) return
    setForm({
      business_name: alias.business_name,
      business_address: alias.business_address ?? '',
      business_contact_person: alias.business_contact_person ?? '',
      business_contact_number: alias.business_contact_number ?? '',
      business_email: alias.business_email ?? '',
      payment_bank_name: alias.payment_bank_name ?? '',
      payment_account_name: alias.payment_account_name ?? '',
      payment_account_number: alias.payment_account_number ?? '',
    })
    setHasLogo(!!alias.business_logo_key)
    setInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, alias?.business_id])

  const initialForm = alias
    ? {
        business_name: alias.business_name,
        business_address: alias.business_address ?? '',
        business_contact_person: alias.business_contact_person ?? '',
        business_contact_number: alias.business_contact_number ?? '',
        business_email: alias.business_email ?? '',
        payment_bank_name: alias.payment_bank_name ?? '',
        payment_account_name: alias.payment_account_name ?? '',
        payment_account_number: alias.payment_account_number ?? '',
      }
    : emptyForm
  const dirty = Object.entries(form).some(([key, value]) => value !== initialForm[key as keyof typeof initialForm])

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleBack() {
    if (dirty && !saving) {
      setConfirmLeave(true)
      return
    }
    navigate('/alias-settings')
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedArea(null)
    }
    reader.readAsDataURL(file)
  }

  async function handleSaveCroppedLogo() {
    if (!cropSrc || !croppedArea || !alias) return
    setError(null)
    try {
      const blob = await getCroppedImageBlob(cropSrc, croppedArea)
      await uploadLogoMutation.mutateAsync({ businessId: alias.business_id, blob })
      setHasLogo(true)
      setLogoVersion((v) => v + 1)
      setCropSrc(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const input: BusinessInput = {
        business_name: form.business_name.trim(),
        business_address: form.business_address.trim() || null,
        business_contact_person: form.business_contact_person.trim() || null,
        business_contact_number: form.business_contact_number.trim() || null,
        business_email: form.business_email.trim() || null,
        payment_bank_name: form.payment_bank_name.trim() || null,
        payment_account_name: form.payment_account_name.trim() || null,
        payment_account_number: form.payment_account_number.trim() || null,
      }
      if (alias) {
        await updateMutation.mutateAsync({ businessId: alias.business_id, input })
        navigate('/alias-settings')
      } else {
        const created = await createMutation.mutateAsync(input)
        navigate(`/alias-settings/${created.business_id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alias')
    }
  }

  if (businessId != null && loading && !initialized) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={handleBack}>
          ← Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{alias ? 'Edit Alias' : 'Add Alias'}</h1>
      </div>

      {alias && (
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {hasLogo ? (
              <img
                key={logoVersion}
                src={getBusinessAliasLogoUrl(alias.business_id)}
                alt="Alias logo"
                className="h-20 w-20 rounded-md border object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-md border bg-muted" />
            )}
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Upload logo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-3 rounded-md border bg-panel p-4 shadow-lg">
            <h2 className="font-semibold">Crop logo</h2>
            <p className="text-sm text-muted-foreground">
              Drag to reposition, scroll or use the slider to zoom. The highlighted square is what gets saved.
            </p>
            <div className="relative h-64 w-full bg-muted">
              <style>{`
                .reactEasyCrop_CropAreaGrid::before,
                .reactEasyCrop_CropAreaGrid::after {
                  border-color: #4b5563 !important;
                  background-color: transparent !important;
                }
              `}</style>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, area) => setCroppedArea(area)}
                style={{
                  cropAreaStyle: {
                    border: '2px solid #4b5563',
                    boxShadow: '0 0 0 1px #fff, 0 0 0 9999em rgba(0,0,0,0.5)',
                  },
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="alias_zoom" className="text-sm text-muted-foreground">
                Zoom
              </Label>
              <input
                id="alias_zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleSaveCroppedLogo} disabled={uploadLogoMutation.isPending}>
                {uploadLogoMutation.isPending ? 'Uploading…' : 'Save logo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCropSrc(null)}
                disabled={uploadLogoMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <form className="max-w-md space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="alias_business_name">Business Name</Label>
          <Input
            id="alias_business_name"
            value={form.business_name}
            onChange={(e) => update('business_name', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias_business_address">Address</Label>
          <Input
            id="alias_business_address"
            value={form.business_address}
            onChange={(e) => update('business_address', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias_business_contact_person">Contact Person</Label>
          <Input
            id="alias_business_contact_person"
            value={form.business_contact_person}
            onChange={(e) => update('business_contact_person', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias_business_contact_number">Contact Number</Label>
          <Input
            id="alias_business_contact_number"
            type="tel"
            inputMode="numeric"
            value={form.business_contact_number}
            onChange={(e) => update('business_contact_number', e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias_business_email">Email</Label>
          <Input
            id="alias_business_email"
            type="email"
            value={form.business_email}
            onChange={(e) => update('business_email', e.target.value)}
          />
        </div>
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="alias_payment_bank_name">Payment Bank</Label>
          <Input
            id="alias_payment_bank_name"
            value={form.payment_bank_name}
            onChange={(e) => update('payment_bank_name', e.target.value)}
            placeholder="e.g. BCA"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias_payment_account_name">Account Name</Label>
          <Input
            id="alias_payment_account_name"
            value={form.payment_account_name}
            onChange={(e) => update('payment_account_name', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias_payment_account_number">Account Number</Label>
          <Input
            id="alias_payment_account_number"
            value={form.payment_account_number}
            onChange={(e) => update('payment_account_number', e.target.value)}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="outline" onClick={handleBack} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. If you leave now, they will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeave(false)
                navigate('/alias-settings')
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
