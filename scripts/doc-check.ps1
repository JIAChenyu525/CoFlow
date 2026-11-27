$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    foreach ($name in @('src', 'manual')) {
        $path = "D:\CoFlow\_check\$name.docx"
        $doc = $word.Documents.Open($path, $false, $true)
        $pages = $doc.ComputeStatistics(2)
        $words = $doc.ComputeStatistics(0)
        $chars = $doc.ComputeStatistics(3)
        Write-Output "$name pages=$pages words=$words chars=$chars"
        $doc.SaveAs2("D:\CoFlow\_check\$name.pdf", 17)
        $doc.Close($false)
    }
}
finally {
    $word.Quit()
}
