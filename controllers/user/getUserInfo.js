
const getUserInfo = async (req, res) => {
    try {
        const user = {
            name: 'PA. Duong Dam',
            email: 'duong.dam@classfunc.com',
            phone: '0826226368',
            address: '28 Tran Binh, My Dinh 2, Nam Tu Liem, Ha Noi',
            avatar: 'https://i.pravatar.cc/300',
        }

        res.status(200).json(user);
    } catch (error) {
        console.log(error);
        res.status(500).json({message: 'Internal Server Error'});
    }
}

module.exports = getUserInfo;