# Get all .js and .css files in the current directory
$files = Get-ChildItem -Path . | Where-Object { $_.Extension -eq ".js" -or $_.Extension -eq ".css" }

# Loop through each file
foreach ($file in $files) {
    # Get the content of the file
    $fileContent = Get-Content $file.FullName

    # Generate new file name with .txt extension
    $newFileName = [System.IO.Path]::ChangeExtension($file.FullName, ".txt")

    # Write the content to the new .txt file
    $fileContent | Out-File -FilePath $newFileName -Force

    Write-Host "Successfully created: $newFileName"
}
