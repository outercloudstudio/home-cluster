Deno.serve({ port: 2000 }, async (request) => {
    return new Response(`
<!DOCTYPE html>
<html>
<body>

<h1>Hello!</h1>

</body>
</html>
        `, { 
            status: 200,
            headers: {
            "Content-Type": "text/html; charset=utf-8",
        },
         })
})