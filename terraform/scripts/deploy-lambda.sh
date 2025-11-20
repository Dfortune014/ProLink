functions=("profiles" "links" "upload")

for func in "${functions[@]}"; do
    echo "Packaging $func..."

    if [ -f "lambda/$func.zip" ]; then
        rm "lambda/$func.zip"
    fi

    zip -r "lambda/$func.zip" "lambda/$func/"

    echo "$func packaged successfully"
done

echo "All functions packaged. Run 'terraform apply' to deploy."