import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getBusinessAliasLogoUrl } from '@/lib/business'
import { useBusinessAliasesQuery } from '@/lib/queries'

export function AliasSettingsPage() {
  const { data: aliases = [], isLoading: loading } = useBusinessAliasesQuery()
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Alias</h1>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Alternative identities for the company, same fields as Business Settings.
        </p>
        <Button onClick={() => navigate('/alias-settings/new')}>+ Add Alias</Button>
      </div>

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Logo</TableHead>
              <TableHead>Business Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Contact Number</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Payment Bank</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : aliases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  No aliases yet.
                </TableCell>
              </TableRow>
            ) : (
              aliases.map((alias) => (
                <TableRow key={alias.business_id}>
                  <TableCell>
                    {alias.business_logo_key ? (
                      <img
                        src={getBusinessAliasLogoUrl(alias.business_id)}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>{alias.business_name}</TableCell>
                  <TableCell>{alias.business_address ?? '-'}</TableCell>
                  <TableCell>{alias.business_contact_person ?? '-'}</TableCell>
                  <TableCell>{alias.business_contact_number ?? '-'}</TableCell>
                  <TableCell>{alias.business_email ?? '-'}</TableCell>
                  <TableCell>{alias.payment_bank_name ?? '-'}</TableCell>
                  <TableCell>{alias.payment_account_name ?? '-'}</TableCell>
                  <TableCell>{alias.payment_account_number ?? '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/alias-settings/${alias.business_id}`)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
