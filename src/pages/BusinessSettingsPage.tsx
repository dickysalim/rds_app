import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getBusiness,
  getBusinessLogoUrl,
  updateBusiness,
  uploadBusinessLogo,
  type Business,
} from '@/lib/business'
import { getCroppedImageBlob } from '@/lib/cropImage'

export function BusinessSettingsPage() {
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessContactNumber, setBusinessContactNumber] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [hasLogo, setHasLogo] = useState(false)
  const [logoVersion, setLogoVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getBusiness()
      .then((business: Business | null) => {
        if (!business) return
        setBusinessName(business.business_name)
        setBusinessAddress(business.business_address ?? '')
        setBusinessContactNumber(business.business_contact_number ?? '')
        setBusinessEmail(business.business_email ?? '')
        setHasLogo(!!business.business_logo_key)
      })
      .finally(() => setLoading(false))
  }, [])

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
    if (!cropSrc || !croppedArea) return
    setUploadingLogo(true)
    setError(null)
    try {
      const blob = await getCroppedImageBlob(cropSrc, croppedArea)
      await uploadBusinessLogo(blob)
      setHasLogo(true)
      setLogoVersion((v) => v + 1)
      setCropSrc(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      await updateBusiness({
        business_name: businessName,
        business_address: businessAddress || null,
        business_contact_number: businessContactNumber || null,
        business_email: businessEmail || null,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save business settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Business Settings</h1>

      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          {hasLogo ? (
            <img
              key={logoVersion}
              src={getBusinessLogoUrl()}
              alt="Business logo"
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

      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-3 rounded-md border bg-background p-4 shadow-lg">
            <h2 className="font-semibold">Crop logo</h2>
            <p className="text-sm text-muted-foreground">
              Drag to reposition, scroll or use the slider to zoom. The highlighted square is
              what gets saved.
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
              <Label htmlFor="zoom" className="text-sm text-muted-foreground">
                Zoom
              </Label>
              <input
                id="zoom"
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
              <Button type="button" onClick={handleSaveCroppedLogo} disabled={uploadingLogo}>
                {uploadingLogo ? 'Uploading…' : 'Save logo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCropSrc(null)}
                disabled={uploadingLogo}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <form className="max-w-md space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="business_name">Business Name</Label>
          <Input
            id="business_name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_address">Address</Label>
          <Input
            id="business_address"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_contact_number">Contact Number</Label>
          <Input
            id="business_contact_number"
            value={businessContactNumber}
            onChange={(e) => setBusinessContactNumber(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_email">Email</Label>
          <Input
            id="business_email"
            type="email"
            value={businessEmail}
            onChange={(e) => setBusinessEmail(e.target.value)}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && !error && <p className="text-sm text-muted-foreground">Saved.</p>}
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  )
}
