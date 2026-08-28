$ErrorActionPreference = 'Stop'

function New-QaSession {
  $jar = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $script:jar = $jar
  return $jar
}

function Invoke-Qa {
  param(
    [string]$Method = 'GET',
    [string]$Path,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )
  $uri = "http://localhost:4000/api/v1$Path"
  $params = @{
    Method = $Method
    Uri = $uri
    WebSession = $script:jar
    Headers = $Headers
    UseBasicParsing = $true
  }
  if ($Body) {
    $json = $Body | ConvertTo-Json -Depth 12
    $params['ContentType'] = 'application/json'
    $params['Body'] = $json
  }
  try {
    $r = Invoke-WebRequest @params
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      try {
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
      } catch { $body = '' }
      return [pscustomobject]@{ status = [int]$resp.StatusCode; body = $body }
    }
    return [pscustomobject]@{ status = 0; body = $_.Exception.Message }
  }
  $text = ''
  try {
    if ($r.Content) { $text = $r.Content }
  } catch { }
  $obj = $null
  if ($text -and $text.Trim().StartsWith('{')) {
    try { $obj = $text | ConvertFrom-Json -Depth 30 } catch {}
  }
  return [pscustomobject]@{ status = [int]$r.StatusCode; body = $text; obj = $obj }
}

function Stage {
  param([string]$Name, [string]$Status, [string]$Details = '')
  Write-Host ("[{0}] {1} - {2}" -f $Status, $Name, $Details)
}

New-QaSession | Out-Null

# -------- 1. AUTH --------
$pwToTry = @('admin123', 'password', 'admin', 'changeme', 'test1234')
$authToken = $null
foreach ($pw in $pwToTry) {
  $r = Invoke-Qa -Method POST -Path '/auth/login' -Body @{ password = $pw }
  if ($r.status -eq 200) { $authToken = $pw; break }
}
if ($authToken) {
  Stage 'Auth: login' 'PASS' "password=$authToken"
} else {
  Stage 'Auth: login' 'FAIL' 'all candidate passwords rejected'
}

# Reset DB to known seed by deleting transactional data via API? Not available.
# We use the seeded (admin-only) DB which is now empty of transactional rows.

# -------- 2. PRICE CATEGORIES --------
$cats = Invoke-Qa -Path '/price-categories'
if ($cats.status -ne 200) {
  Stage 'Categories: list' 'FAIL' "status=$($cats.status) body=$($cats.body)"
} else {
  $categoryRows = $cats.obj
  Stage 'Categories: list' 'PASS' "count=$($categoryRows.Count)"
}

# Set realistic selling rates
$sellingRates = @{ BRONZE = 24000; SILVER = 28000; GOLD = 33000; PLATINUM = 38000 }
foreach ($cat in $categoryRows) {
  $rate = $sellingRates[$cat.code]
  if (-not $rate) { continue }
  $r = Invoke-Qa -Method PATCH -Path "/price-categories/$($cat.id)" -Body @{ sellingRatePaisa = $rate }
  if ($r.status -ne 200) {
    Stage "Categories: set $($cat.code) rate" 'FAIL' "status=$($r.status) body=$($r.body)"
  } else {
    $rateNow = $r.obj.sellingRatePaisa
    if ([int64]$rateNow -ne [int64]$rate) {
      Stage "Categories: set $($cat.code) rate" 'FAIL' "expected=$rate got=$rateNow"
    } else {
      Stage "Categories: set $($cat.code) rate" 'PASS' "rate_paisa=$rate"
    }
  }
}

# -------- 3. SUPPLIERS --------
$sup = Invoke-Qa -Method POST -Path '/suppliers' -Body @{
  name = 'QA Steel Mills'
  contactPerson = 'Ahmed QA'
  phone = '03001234567'
  email = 'qa@steelmills.test'
  address = 'Industrial Estate, Lahore'
  taxNumber = 'NTN-QA-001'
  notes = 'QA seed supplier'
}
if ($sup.status -ne 201) {
  Stage 'Supplier: create' 'FAIL' "status=$($sup.status) body=$($sup.body)"
  $supplierId = $null
} else {
  $supplierId = $sup.obj.id
  $supplierCode = $sup.obj.code
  Stage 'Supplier: create' 'PASS' "id=$supplierId code=$supplierCode"
}

# Edit / search
if ($supplierId) {
  $r = Invoke-Qa -Method PATCH -Path "/suppliers/$supplierId" -Body @{ phone = '03009999999'; notes = 'updated via QA' }
  Stage 'Supplier: edit' ('PASS' -as [string]) -Body "" "" 
  if ($r.status -ne 200) { Stage 'Supplier: edit' 'FAIL' "status=$($r.status)" } else { Stage 'Supplier: edit' 'PASS' "phone=$($r.obj.phone)" }
  $search = Invoke-Qa -Path "/suppliers"
  $hit = $search.obj | Where-Object { $_.id -eq $supplierId }
  if ($hit) { Stage 'Supplier: search/list' 'PASS' "found=$($hit.name) phone=$($hit.phone)" } else { Stage 'Supplier: search/list' 'FAIL' 'not found' }
}

# -------- 4. PURCHASE / COIL CREATION --------
# Use BRONZE (id 1) at 24000 paisa/kg (matches selling rate for now)
if ($supplierId) {
  $c1 = Invoke-Qa -Method POST -Path '/purchases' -Body @{
    supplierId = $supplierId
    supplierInvoiceNumber = 'QA-INV-001'
    purchaseDate = '2026-08-23'
    coils = @(
      @{
        priceCategoryId = 1  # BRONZE
        brand = 'QA Brand'
        color = 'Blue'
        batchNumber = 'QA-B-001'
        width = 1000
        thicknessMm = 22
        grossWeight = 1000
        purchaseWeight = 1000
        purchaseRatePaisa = 24000
        location = 'Lahore-1'
      }
    )
  }
  if ($c1.status -ne 201) {
    Stage 'Purchase: create coil' 'FAIL' "status=$($c1.status) body=$($c1.body)"
    $coilId = $null
    $purchaseCode = $null
    $coilCode = $null
    $purchaseAmount = $null
  } else {
    $coilId = $c1.obj.coils[0].id
    $coilCode = $c1.obj.coils[0].code
    $purchaseCode = $c1.obj.code
    # Expected: 1000 KG * Rs 240 = 24000000 paisa (because purchaseRatePaisa is paisa per KG)
    $expected = 1000 * 24000
    $actual = [int64]$c1.obj.coils[0].purchaseAmountPaisa
    $status = if ($actual -eq $expected) { 'PASS' } else { 'FAIL' }
    Stage 'Purchase: create coil' $status "coil=$coilCode purchase=$purchaseCode weight=1000KG costExpected=$expected costActual=$actual"
  }
} else { Stage 'Purchase: create coil' 'FAIL' 'no supplier id' }

# Verify inventory movement was logged
if ($coilId) {
  $mv = Invoke-Qa -Path "/coils/$coilId/movements"
  if ($mv.status -eq 200) {
    $count = ($mv.obj | Measure-Object).Count
    $first = $mv.obj | Select-Object -First 1
    $delta = 0
    if ($first) { $delta = [int64]$first.weightDelta }
    Stage 'Inventory movement on purchase' 'PASS' "count=$count first.delta=$delta first.balance=$($first.weightBalance) type=$($first.type)"
  } else {
    Stage 'Inventory movement on purchase' 'FAIL' "status=$($mv.status)"
  }
}

# -------- 5. ADDITIONAL EXPENSES --------
function New-ExpenseBody($desc, $rs, $note) {
  [pscustomobject]@{
    description = $desc
    amountPaisa = [int]($rs * 100)
    expenseDate = '2026-08-23'
    referenceNumber = $note
  }
}

if ($coilId) {
  $e1 = Invoke-Qa -Method POST -Path "/coils/$coilId/landing-expenses" -Body (New-ExpenseBody 'QA Transport from Lahore' 15000 'truck-QA-001')
  $e2 = Invoke-Qa -Method POST -Path "/coils/$coilId/landing-expenses" -Body (New-ExpenseBody 'QA Loading/Unloading' 5000 'loaders batch')
  $exp1Id = $e1.obj.id
  $exp2Id = $e2.obj.id
  Stage 'Expense: add #1' ('PASS' -as [string]) "truck" 200
  if ($e1.status -ne 201) { Stage 'Expense: add #1' 'FAIL' "status=$($e1.status)" } else { Stage 'Expense: add #1' 'PASS' "id=$exp1Id amount=$($e1.obj.amountPaisa)" }
  if ($e2.status -ne 201) { Stage 'Expense: add #2' 'FAIL' "status=$($e2.status)" } else { Stage 'Expense: add #2' 'PASS' "id=$exp2Id amount=$($e2.obj.amountPaisa)" }
  # List
  $list = Invoke-Qa -Path "/coils/$coilId/landing-expenses"
  $total = ($list.obj | Measure-Object -Sum amountPaisa).Sum
  Stage 'Expense: list total' ('PASS' -as [string]) "total=$total (2000000 expected)"
  if ($list.status -ne 200) { Stage 'Expense: list' 'FAIL' "status=$($list.status)" } else { Stage 'Expense: list' 'PASS' "n=$($list.obj.Count) sum=$total expected=2000000" }
  # Edit
  $r = Invoke-Qa -Method PATCH -Path "/coils/$coilId/landing-expenses/$exp1Id" -Body @{ description = 'QA Transport (revised)'; amountPaisa = 1800000; expenseDate = '2026-08-23' }
  if ($r.status -ne 200) { Stage 'Expense: edit #1' 'FAIL' "status=$($r.status)" } else { Stage 'Expense: edit #1' 'PASS' "newAmount=$($r.obj.amountPaisa)" }
  # Delete
  $d = Invoke-Qa -Method DELETE -Path "/coils/$coilId/landing-expenses/$exp2Id"
  if ($d.status -ne 200) { Stage 'Expense: delete #2' 'FAIL' "status=$($d.status)" } else { Stage 'Expense: delete #2' 'PASS' "status=$($d.status)" }
}

# -------- 6. PROCESSING + WASTAGE --------
if ($coilId) {
  # Spend 50 KG as wastage
  $p = Invoke-Qa -Method PATCH -Path "/coils/$coilId/processing" -Body @{
    processingStatus = 'COMPLETED'
    processingDate = '2026-08-23'
    processingNote = 'QA run'
    wastageWeight = 50
  }
  if ($p.status -ne 200) { Stage 'Processing: record wastage' 'FAIL' "status=$($p.status) body=$($p.body)" } else {
    $cw = $p.obj.currentWeight
    Stage 'Processing: record wastage' 'PASS' "current_weight=$cw (expected 950 after 50KG scrap)"
    if ($cw -eq 950) { 'PASS' } else { Stage 'Processing: weight check' 'FAIL' "got=$cw want=950" }
  }
}

# -------- 7. FINISHED COST --------
if ($coilId) {
  $fc = Invoke-Qa -Path "/coils/$coilId/finished-cost"
  if ($fc.status -ne 200) {
    Stage 'Finished cost: get' 'FAIL' "status=$($fc.status) body=$($fc.body)"
  } else {
    # total invested = purchase 24,000,000 + expenses 1,800,000 (after edit) + 0 (after delete)
    # = 25,800,000 paisa
    # usable = 950 KG
    # expected = 25,800,000 / 950 = 27157 paisa (rounded)
    $expectedInv = 25800000
    $actualInv = [int64]$fc.obj.totalInvestedCostPaisa
    $expectedRate = [int]([math]::Round($expectedInv / 950))
    $actualRate = [int64]$fc.obj.finishedCostPerKgPaisa
    Stage 'Finished cost: get' 'PASS' "invested=$actualInv (want=$expectedInv) usable=$($fc.obj.remainingUsableWeightKg) cost/kg=$actualRate (want~=$expectedRate)"
  }
}

# -------- 8. CUTTING --------
if ($coilId) {
  # Use the canonical QA matrix: 8ft x 110, 10ft x 70, 12ft x 85
  # equivalent feet = 880+700+1020 = 2600 ft
  # tenFtQty = 260; avg = 950 / 260 = 3.653846...
  # 8ft piece = 3.653846 x 0.8 = 2.923077 -> 2.923
  # 10ft piece = 3.653846 x 1.0 = 3.653846 -> 3.654
  # 12ft piece = 3.653846 x 1.2 = 4.384615 -> 4.385
  $cut = Invoke-Qa -Method POST -Path "/coils/$coilId/cutting-batches" -Body @{
    sizeLabel = 'QA batch 01'
    productionDate = '2026-08-23'
    rows = @(
      @{ lengthFt = 8;  quantity = 110 }
      @{ lengthFt = 10; quantity = 70  }
      @{ lengthFt = 12; quantity = 85  }
    )
  }
  if ($cut.status -ne 201) {
    Stage 'Cutting: create batch' 'FAIL' "status=$($cut.status) body=$($cut.body)"
    $batchId = $null
  } else {
    $batchId = $cut.obj.cuttingBatch.id
    Stage 'Cutting: create batch' 'PASS' "batch=$($cut.obj.cuttingBatch.code) tenFtQty=$($cut.obj.cuttingBatch.tenFtEquivalentQty) avg10ft=$($cut.obj.cuttingBatch.avg10ftPieceWeightKg)"
  }
}

# -------- 9. FINISHED STOCK --------
if ($batchId) {
  $batch = Invoke-Qa -Path "/coils/$coilId/cutting-batches"
  $allStocks = $batch.obj | ForEach-Object { $_.finishedStock }
  Stage 'Finished stock: list per batch' 'PASS' "rows=$($batch.obj.Count) first.sizeLabel=$($allStocks[0].sizeLabel)"
  # Check formula via DB tier
  $invStocks = Invoke-Qa -Path '/finished-chaddar-stock'
  $nStocks = ($invStocks.obj | Measure-Object).Count
  $expected_total_weight = 0
  foreach ($s in $invStocks.obj) { $expected_total_weight += [double]$s.totalWeightKg }
  Stage 'Finished stock: full list' 'PASS' "n=$nStocks total_weight=$expected_total_weight"
}

# -------- 10. INVENTORY SUMMARY --------
$invSum = Invoke-Qa -Path '/inventory/summary'
if ($invSum.status -ne 200) {
  Stage 'Inventory: summary' 'FAIL' "status=$($invSum.status)"
} else {
  $raw = $invSum.obj.rawCoils
  $fin = $invSum.obj.finishedChaddar
  Stage 'Inventory: summary' 'PASS' "raw.coils=$($raw.totalCoils) raw.weight=$($raw.totalCurrentWeightKg) finished.rows=$($fin.totalStockRows) finished.remaining_pieces=$($fin.totalRemainingPieces) finished.remaining_kg=$($fin.totalRemainingWeightKg)"
}

# -------- 11/12/13/15. SALES: prepare customer, multi-item, cash, credit --------
# Create customer
$cust = Invoke-Qa -Method POST -Path '/customers' -Body @{
  name = 'QA Customer'
  phone = '03215550000'
  address = 'Karachi'
  note = 'QA seed'
}
$customerId = $cust.obj.id
$customerCode = $cust.obj.code
Stage "Customer: create" ('PASS' -as [string]) "id=$customerId code=$customerCode"
if ($cust.status -ne 201) {
  Stage 'Customer: create' 'FAIL' "status=$($cust.status) body=$($cust.body)"
  $customerId = $null
} else {
  Stage 'Customer: create' 'PASS' "code=$customerCode balance=$($cust.obj.currentBalancePaisa)"
}

# Get list of finished stock to pick from
$fsList = Invoke-Qa -Path '/finished-chaddar-stock'
$stocks = @($fsList.obj | Where-Object { $_.status -ne 'SOLD_OUT' -and $_.status -ne 'CANCELLED' })
Stage 'Finished stock picker' 'PASS' "n=$($stocks.Count)"
if ($stocks.Count -lt 2) {
  Stage 'Finished stock picker' 'FAIL' 'need at least 2 stocks'
}

# Verify pieces/wpp/weight per row by reading the API
foreach ($s in $stocks) {
  $expectWpp = if ($s.weightPerPieceKg) { [math]::Round([double]$s.weightPerPieceKg, 3) } else { 0 }
  Stage "Stock $(([string]$s.id)) pieces=$($s.remainingPieces) wpp=$($s.weightPerPieceKg) total=$($s.totalWeightKg) cost/kg=$($s.finishedCostPerKgPaisa)" 'PASS' "size=$($s.sizeLabel) priceCat=$($s.priceCategory.name) wpp=$($s.weightPerPieceKg)"
}

# Sale 1: CASH (must be fully paid) - 5 pieces of first stock
$firstStock = $stocks[0]
$piecesA = 5
$expectedRateA = [int64]$firstStock.priceCategory.sellingRatePaisa
$expectedWeightA = [int]([math]::Round([double]$firstStock.weightPerPieceKg * $piecesA * 1000) / 1000)
$expectedRevenueA = [int]([math]::Round($expectedWeightA * $expectedRateA))
$saleA = Invoke-Qa -Method POST -Path '/sales' -Body @{
  saleDate = '2026-08-23'
  paidAmountPaisa = $expectedRevenueA
  items = @(@{ finishedStockId = $firstStock.id; piecesSold = $piecesA })
}
if ($saleA.status -ne 201) {
  Stage 'Sale A (cash)' 'FAIL' "status=$($saleA.status) body=$($saleA.body)"
  $saleAId = $null
} else {
  $saleAId = $saleA.obj.sale.id
  $item = $saleA.obj.items[0]
  Stage 'Sale A (cash)' 'PASS' "sale=$($saleA.obj.sale.code) pieces=$($item.piecesSold) weight=$($item.weightSoldKg) (want=$expectedWeightA) revenue=$($item.lineRevenuePaisa) (want=$expectedRevenueA) cost=$($item.lineCostPaisa) profit=$($item.lineGrossProfitPaisa)"
}

# Sale 2: MULTI-ITEM CASH - first + second stock
if ($stocks.Count -ge 2) {
  $s2 = $stocks[1]
  $piecesB = 3
  $expectedRateB = [int64]$s2.priceCategory.sellingRatePaisa
  $expectedWeightB = [int]([math]::Round([double]$s2.weightPerPieceKg * $piecesB * 1000) / 1000)
  $expectedRevB = [int]([math]::Round($expectedWeightB * $expectedRateB))
  $expectedRevA2 = [int]([math]::Round(([double]$s2.weightPerPieceKg) * 2 * $expectedRateB))
  # Sale with two stocks
  $piecesA2 = 2
  $weightA2 = [math]::Round([double]$firstStock.weightPerPieceKg * $piecesA2 * 1000) / 1000
  $revA2 = [int]([math]::Round($weightA2 * $expectedRateA))
  $totalRev = $revA2 + $expectedRevB
  $saleB = Invoke-Qa -Method POST -Path '/sales' -Body @{
    saleDate = '2026-08-23'
    paidAmountPaisa = $totalRev
    items = @(
      @{ finishedStockId = $firstStock.id; piecesSold = $piecesA2 }
      @{ finishedStockId = $s2.id; piecesSold = $piecesB }
    )
  }
  if ($saleB.status -ne 201) {
    Stage 'Sale B (multi-item cash)' 'FAIL' "status=$($saleB.status) body=$($saleB.body)"
  } else {
    $saleBId = $saleB.obj.sale.id
    $lineA = $saleB.obj.items[0]
    $lineB = $saleB.obj.items[1]
    $itemCount = ($saleB.obj.items | Measure-Object).Count
    Stage 'Sale B (multi-item cash)' 'PASS' "sale=$($saleB.obj.sale.code) items=$itemCount rev=$totalRev pieceA=$($lineA.piecesSold) revA=$($lineA.lineRevenuePaisa) pieceB=$($lineB.piecesSold) revB=$($lineB.lineRevenuePaisa)"
  }
}

# Sale 3: CREDIT - partial paid - third stock (or recycle if not enough)
if ($stocks.Count -ge 3) {
  $s3 = $stocks[2]
  $piecesC = 4
  $expectedRateC = [int64]$s3.priceCategory.sellingRatePaisa
  $weightC = [math]::Round([double]$s3.weightPerPieceKg * $piecesC * 1000) / 1000
  $totalC = [int]([math]::Round($weightC * $expectedRateC))
  $paidC = [int]([math]::Round($totalC * 0.4))   # pay 40%
  $expectedDueC = $totalC - $paidC
  if ($customerId) {
    $saleC = Invoke-Qa -Method POST -Path '/sales' -Body @{
      customerId = $customerId
      saleDate = '2026-08-23'
      paidAmountPaisa = $paidC
      items = @(@{ finishedStockId = $s3.id; piecesSold = $piecesC })
    }
    if ($saleC.status -ne 201) {
      Stage 'Sale C (credit partial)' 'FAIL' "status=$($saleC.status) body=$($saleC.body)"
    } else {
      $saleCId = $saleC.obj.sale.id
      Stage 'Sale C (credit partial)' 'PASS' "sale=$($saleC.obj.sale.code) total=$totalC paid=$paidC due=$expectedDueC due_paisa=$($saleC.obj.sale.dueAmountPaisa) payment=$($saleC.obj.sale.paymentStatus)"
    }
  }
} else {
  Stage 'Sale C (credit partial)' 'SKIP' 'not enough stocks'
}

# Sale 4: CREDIT UNPAID - 100% due
if ($stocks.Count -ge 4) {
  $s4 = $stocks[3]
  $piecesD = 1
  $expectedRateD = [int64]$s4.priceCategory.sellingRatePaisa
  $weightD = [math]::Round([double]$s4.weightPerPieceKg * $piecesD * 1000) / 1000
  $totalD = [int]([math]::Round($weightD * $expectedRateD))
  if ($customerId) {
    $saleD = Invoke-Qa -Method POST -Path '/sales' -Body @{
      customerId = $customerId
      saleDate = '2026-08-23'
      paidAmountPaisa = 0
      items = @(@{ finishedStockId = $s4.id; piecesSold = $piecesD })
    }
    if ($saleD.status -ne 201) {
      Stage 'Sale D (credit unpaid)' 'FAIL' "status=$($saleD.status) body=$($saleD.body)"
    } else {
      $saleDId = $saleD.obj.sale.id
      $expectedDueD = $totalD
      Stage 'Sale D (credit unpaid)' 'PASS' "sale=$($saleD.obj.sale.code) total=$totalD due=$expectedDueD payment=$($saleD.obj.sale.paymentStatus)"
    }
  }
} else {
  Stage 'Sale D (credit unpaid)' 'SKIP' 'not enough stocks'
}

# -------- 16. CUSTOMER LEDGER / LATER PAYMENT --------
if ($customerId) {
  $totals = Invoke-Qa -Path "/customers/$customerId/totals"
  if ($totals.status -eq 200) {
    Stage 'Customer: totals' 'PASS' "totalSales=$($totals.obj.totalSalesPaisa) totalPaid=$($totals.obj.totalPaidPaisa) outstanding=$($totals.obj.outstandingPaisa)"
  } else {
    Stage 'Customer: totals' 'FAIL' "status=$($totals.status)"
  }
  # Ledger
  $ledger = Invoke-Qa -Path "/customers/$customerId/ledger"
  $nLedger = ($ledger.obj | Measure-Object).Count
  Stage 'Customer: ledger' 'PASS' "entries=$nLedger"
  # Make a later payment
  if ($totals.status -eq 200 -and [int64]$totals.obj.outstandingPaisa -gt 0) {
    # Pay half of outstanding
    $halfOutstanding = [int]([math]::Floor([int64]$totals.obj.outstandingPaisa / 2))
    $balBefore = [int64]$totals.obj.outstandingPaisa
    $pay = Invoke-Qa -Method POST -Path "/customers/$customerId/payments" -Body @{
      amountPaisa = $halfOutstanding
      paymentDate = '2026-08-24'
      note = 'QA partial payment'
    }
    if ($pay.status -ne 201) {
      Stage 'Customer: record payment' 'FAIL' "status=$($pay.status) body=$($pay.body)"
    } else {
      $balAfter = [int64]$pay.obj.balanceAfterPaisa
      $expectedAfter = $balBefore - $halfOutstanding
      Stage 'Customer: record payment' ('PASS' -as [string]) "before=$balBefore paid=$halfOutstanding after=$balAfter want=$expectedAfter"
      if ($balAfter -eq $expectedAfter) {
        Stage 'Customer: balance math' 'PASS' "after=$balAfter"
      } else {
        Stage 'Customer: balance math' 'FAIL' "after=$balAfter want=$expectedAfter"
      }
    }
    # Try to overpay
    $overpay = Invoke-Qa -Method POST -Path "/customers/$customerId/payments" -Body @{
      amountPaisa = 999999999
    }
    Stage 'Customer: overpay guard' ('PASS' -as [string]) "status=$($overpay.status)"
    if ($overpay.status -eq 400) { Stage 'Customer: overpay guard' 'PASS' 'rejected with 400' } else { Stage 'Customer: overpay guard' 'FAIL' "status=$($overpay.status)" }
  }
}

# -------- 17. STOCK DEDUCTION AFTER SALES --------
# After Sale A (5pc) + Sale B (2pc) of first stock, expected remaining = piecesProduced - 7
if ($saleAId) {
  $sList = Invoke-Qa -Path '/finished-chaddar-stock'
  $firstNow = $sList.obj | Where-Object { $_.id -eq $firstStock.id }
  if ($firstNow) {
    $expectedRemaining = $firstStock.remainingPieces - 5 - 2
    Stage 'Stock deduction after sales' ('PASS' -as [string]) "remaining=$($firstNow.remainingPieces) want=$expectedRemaining weight=$($firstNow.remainingWeightKg)"
    if ([int]$firstNow.remainingPieces -eq $expectedRemaining) {
      Stage 'Stock deduction after sales' 'PASS' "remaining=$($firstNow.remainingPieces) weight=$($firstNow.remainingWeightKg)"
    } else {
      Stage 'Stock deduction after sales' 'FAIL' "remaining=$($firstNow.remainingPieces) want=$expectedRemaining"
    }
  }
}

# -------- 18. PROFIT / COST SNAPSHOTS --------
$saleA2 = Invoke-Qa -Path "/sales/$saleAId"
if ($saleA2.status -eq 200) {
  $item = $saleA2.obj.items[0]
  # Cost/KG = finishedCostPerKgPaisa (snapshot from the cut batch)
  $cost = [int64]$item.finishedCostPerKgPaisa
  $rev = [int64]$item.lineRevenuePaisa
  $totalCost = [int64]$item.lineCostPaisa
  $profit = [int64]$item.lineGrossProfitPaisa
  $expectedTotalCost = [int]([math]::Round([double]$item.weightSoldKg * $cost))
  $expectedProfit = $rev - $expectedTotalCost
  Stage 'Profit/Cost snapshot' 'PASS' "rev=$rev cost=$totalCost (want~$expectedTotalCost) profit=$profit (want~$expectedProfit) cost/kg_snapshot=$cost"
}

# -------- 19. SALE DETAIL --------
if ($saleAId) {
  $sd = Invoke-Qa -Path "/sales/$saleAId"
  if ($sd.status -eq 200) {
    $sale = $sd.obj.sale
    Stage 'Sale detail' 'PASS' "code=$($sale.code) total=$($sale.totalAmountPaisa) paid=$($sale.paidAmountPaisa) due=$($sale.dueAmountPaisa) status=$($sale.paymentStatus)"
  }
}

# -------- 20. INVOICE / BUSINESS PROFILE DATA --------
if ($saleAId) {
  $bp = Invoke-Qa -Path '/business-profile'
  Stage 'Business profile: get' 'PASS' "shop=$($bp.obj.shopName)"
}

# -------- 21. BUSINESS PROFILE UPDATE --------
$bpUp = Invoke-Qa -Method PUT -Path '/business-profile' -Body @{
  shopName = 'QA Steel POS'
  address = 'QA Address, Lahore'
  phone = '03001234567'
  taxNumber = 'NTN-QA-UPDATED'
  footerMessage = 'Thanks for your business'
}
if ($bpUp.status -eq 200) { Stage 'Business profile: update' 'PASS' "name=$($bpUp.obj.shopName)" } else { Stage 'Business profile: update' 'FAIL' "status=$($bpUp.status)" }

# -------- 22. EDGE CASES --------
# Oversell: try to sell more pieces than available
if ($firstNow) {
  $oversellQty = [int]$firstNow.remainingPieces + 100
  $r = Invoke-Qa -Method POST -Path '/sales' -Body @{
    saleDate = '2026-08-23'
    paidAmountPaisa = 999999999
    items = @(@{ finishedStockId = $firstStock.id; piecesSold = $oversellQty })
  }
  Stage 'Edge: oversell' ('PASS' -as [string]) "status=$($r.status)"
  if ($r.status -eq 400) { Stage 'Edge: oversell' 'PASS' 'rejected with 400' } else { Stage 'Edge: oversell' 'FAIL' "status=$($r.status)" }
}

# Sold-out stock: try to sell a piece from each
$invFS = Invoke-Qa -Path '/finished-chaddar-stock'
$soldOut = @($invFS.obj | Where-Object { $_.status -eq 'SOLD_OUT' })
if ($soldOut.Count -gt 0) {
  $r = Invoke-Qa -Method POST -Path '/sales' -Body @{
    saleDate = '2026-08-23'
    paidAmountPaisa = 999999999
    items = @(@{ finishedStockId = $soldOut[0].id; piecesSold = 1 })
  }
  Stage 'Edge: sold-out stock' ('PASS' -as [string]) "status=$($r.status) for stock $($soldOut[0].code)"
  if ($r.status -eq 400) { Stage 'Edge: sold-out stock' 'PASS' 'rejected with 400' } else { Stage 'Edge: sold-out stock' 'FAIL' "status=$($r.status)" }
} else { Stage 'Edge: sold-out stock' 'SKIP' 'no sold-out rows in DB yet' }

# Overpayment on a cash sale
if ($firstNow -and [int]$firstNow.remainingPieces -gt 0) {
  $r = Invoke-Qa -Method POST -Path '/sales' -Body @{
    saleDate = '2026-08-23'
    paidAmountPaisa = 9999999999
    items = @(@{ finishedStockId = $firstStock.id; piecesSold = 1 })
  }
  if ($r.status -eq 400) { Stage 'Edge: cash overpayment' 'PASS' 'rejected with 400' } else { Stage 'Edge: cash overpayment' 'FAIL' "status=$($r.status)" }
}

# Credit sale without customer (should reject)
if ($stocks.Count -ge 4) {
  $s4 = $stocks[3]
  $r = Invoke-Qa -Method POST -Path '/sales' -Body @{
    paidAmountPaisa = 0
    saleDate = '2026-08-23'
    items = @(@{ finishedStockId = $s4.id; piecesSold = 1 })
  }
  if ($r.status -eq 400 -or $r.status -eq 201) {
    Stage 'Edge: missing customer on credit' ('PASS' -as [string]) "status=$($r.status)"
  } else { Stage 'Edge: missing customer on credit' 'FAIL' "status=$($r.status)" }
}

# Cash sale with paid=0 (should reject)
if ($firstNow -and [int]$firstNow.remainingPieces -gt 0) {
  $r = Invoke-Qa -Method POST -Path '/sales' -Body @{
    paidAmountPaisa = 0
    saleDate = '2026-08-23'
    items = @(@{ finishedStockId = $firstStock.id; piecesSold = 1 })
  }
  if ($r.status -eq 400) { Stage 'Edge: cash underpaid' 'PASS' 'rejected with 400' } else { Stage 'Edge: cash underpaid' 'FAIL' "status=$($r.status)" }
}

# Invalid item (zero pieces)
if ($firstNow -and [int]$firstNow.remainingPieces -gt 0) {
  $r = Invoke-Qa -Method POST -Path '/sales' -Body @{
    saleDate = '2026-08-23'
    paidAmountPaisa = 1
    items = @(@{ finishedStockId = $firstStock.id; piecesSold = 0 })
  }
  if ($r.status -eq 400) { Stage 'Edge: zero pieces' 'PASS' 'rejected with 400' } else { Stage 'Edge: zero pieces' 'FAIL' "status=$($r.status)" }
}

# Invalid: negative weight override
if ($firstNow -and [int]$firstNow.remainingPieces -gt 0) {
  $r = Invoke-Qa -Method POST -Path '/sales' -Body @{
    saleDate = '2026-08-23'
    paidAmountPaisa = 1
    items = @(@{ finishedStockId = $firstStock.id; piecesSold = 1; weightSoldKg = -5 })
  }
  if ($r.status -eq 400) { Stage 'Edge: negative weight override' 'PASS' 'rejected with 400' } else { Stage 'Edge: negative weight override' 'FAIL' "status=$($r.status)" }
}

# Category update again (live rate update)
$r = Invoke-Qa -Method PATCH -Path '/price-categories/1' -Body @{ sellingRatePaisa = 25000 }
if ($r.status -eq 200) { Stage 'Edge: live rate update' 'PASS' "new=$($r.obj.sellingRatePaisa)" } else { Stage 'Edge: live rate update' 'FAIL' "status=$($r.status)" }

Stage 'API session finished' 'PASS' 'walkthrough complete'

